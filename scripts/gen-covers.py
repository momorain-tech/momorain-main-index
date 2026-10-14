#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用豆包 Seedream 5.0（火山方舟 Ark）生成项目案例封面（16:10）。

用法（Key 不落盘，从环境变量读取）:
    DOUBAO_IMAGE_API_KEY=xxx python3 scripts/gen-covers.py

输出: public/images/demos/{slug}/cover.jpg（2560x1600，约 ¥0.15/张），
前端封面地址跟着换成了 .jpg（lib/projects-data.ts + migrations/007）。
风格: 2026-10-14 用户反馈两轮后定稿——B站优质视频封面感：每张独立配色、
独立构图、带一个有表情的人物 + 一条大字中文标题，不再共用统一风格前缀。
规范出处: workspace 根目录 gimi-illustration-tech.md §10。
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
MODEL = "doubao-seedream-5-0-260128"
# Seedream 5.0 最低像素 3,686,400；2560x1600 = 4,096,000 ✓ 且正好 16:10
SIZE = "2560x1600"

REPO = Path(__file__).resolve().parents[1]

# 共享的只有质量底线，风格各张自定（用户 2026-10-14：不要系列感、要活人感、要 B站封面感）
STYLE = (
    "B站优质视频封面风格：构图夸张有冲击力，色彩高饱和撞色，插画质感，"
    "人物表情生动有活力；画面中只出现标题里指定的文字，其余任何文字、字母、水印都不要"
)

PROJECTS: list[tuple[str, str]] = [
    (
        "talk-to-fengge",
        "暖橙红色调。一个戴耳机的年轻男生半身像，表情夸张兴奋，正对着麦克风说话，"
        "声波环绕，身后是发光的AI数据流头像。大标题「和AI分身实时聊天」",
    ),
    (
        "whiteboard-video",
        "蓝绿色调。一个老师形象的人手持马克笔站在白板前，手指着板上的手绘示意图，"
        "表情自信带笑，白板上是圆圈、箭头和简笔画。大标题「白板手绘讲解视频」",
    ),
    (
        "clip-sketch",
        "明黄色调。画面左侧是电影胶片，右侧变成铅笔素描的漫画分格教程，"
        "一支铅笔正在画，笔尖有魔法光点。大标题「视频秒变手绘教程」",
    ),
    (
        "openmontage",
        "紫粉色调。电影分镜板前，一个导演模样的人手拿场记板喊开拍，"
        "分镜纸片像爆炸一样飞出，画面动感十足。大标题「一句话生成解说视频」",
    ),
    (
        "cv-workshop",
        "蓝白色调。一个职场年轻人举着自己的简历，表情惊喜，"
        "简历纸面上排版参考线在发光，旁边浮着几块内容卡片。大标题「简历一键排版」",
    ),
    (
        "exprtrain",
        "青橙色调。一个正在练习口语的年轻人对着麦克风说话，表情专注投入，"
        "语音波形变成字幕条，几条字幕被荧光圈出。大标题「AI口语陪练」",
    ),
]


def generate(key: str, prompt: str) -> bytes:
    payload = {
        "model": MODEL,
        "prompt": f"{STYLE}。{prompt}",
        "size": SIZE,
        "n": 1,
        "response_format": "b64_json",
        "watermark": False,
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e

    if "data" not in body or not body["data"]:
        raise RuntimeError(f"响应没有 data 字段: {json.dumps(body, ensure_ascii=False)[:300]}")
    b64 = body["data"][0].get("b64_json")
    if not b64:
        raise RuntimeError(f"响应没有 b64_json 字段: {json.dumps(body, ensure_ascii=False)[:300]}")
    return base64.b64decode(b64)


def to_jpeg_16_10(png_bytes: bytes, out_path: Path) -> None:
    """b64 返回的是 PNG；转成 JPEG 并确保 16:10（不是 16:10 就居中裁切）。"""
    tmp = out_path.with_suffix(".tmp.png")
    tmp.write_bytes(png_bytes)
    # 转 JPEG（质量 85，网页用足够）
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "85", str(tmp), "--out", str(out_path)],
        check=True, capture_output=True,
    )
    tmp.unlink()


def main() -> int:
    key = os.environ.get("DOUBAO_IMAGE_API_KEY")
    if not key:
        print("缺少 DOUBAO_IMAGE_API_KEY 环境变量", file=sys.stderr)
        return 1

    failed = 0
    for slug, scene in PROJECTS:
        out_dir = REPO / "public" / "images" / "demos" / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / "cover.jpg"
        print(f"[{slug}] 生成中…", flush=True)
        try:
            png = generate(key, scene)
            to_jpeg_16_10(png, out)
            size_kb = out.stat().st_size // 1024
            print(f"[{slug}] ✅ {out.relative_to(REPO / 'public')} ({size_kb} KB)", flush=True)
        except Exception as e:  # noqa: BLE001 —— 单张失败不中断整批
            failed += 1
            print(f"[{slug}] ❌ {e}", flush=True)
        time.sleep(2)  # 尊重并发限制（文档建议 ≤3）

    print(f"\n完成：{len(PROJECTS) - failed}/{len(PROJECTS)} 张")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
