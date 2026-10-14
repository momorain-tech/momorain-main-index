#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用豆包 Seedream 5.0（火山方舟 Ark）生成项目案例封面（16:10）。

用法（Key 不落盘，从环境变量读取）:
    DOUBAO_IMAGE_API_KEY=xxx python3 scripts/gen-covers.py

输出: public/covers/{slug}.jpg（2560x1600，约 ¥0.15/张）。
风格: 深色背景 + 紫罗兰/青色霓虹渐变 + 扁平插画，与站点品牌一致；
图内不含文字（AI 生成文字易出错），项目名由页面在封面下方展示。
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

OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "covers"

# 统一风格前缀，保证六张是一个系列
STYLE = (
    "深色背景，紫罗兰与青色霓虹渐变光，扁平插画风格，"
    "简洁现代，画面精致，无文字，无字母，无水印"
)

PROJECTS: list[tuple[str, str]] = [
    (
        "talk-to-fengge",
        "一个年轻人戴着耳机对着手机说话，声音化作的声波环绕着一颗发光的AI头像，"
        "科技感实时语音对话氛围",
    ),
    (
        "whiteboard-video",
        "一块白板上有一只手握着马克笔正在画手绘插画，画面里是简单的教学示意图和箭头，"
        "白板边缘泛着柔和光晕，教学讲解氛围",
    ),
    (
        "clip-sketch",
        "一段电影胶片从画面左侧展开，逐渐变成手绘铅笔线条的分步教程草图，"
        "草图上浮着笔记框和小图标，内容创作氛围",
    ),
    (
        "openmontage",
        "一张电影分镜板旁边，手绘插画风格的画面帧像纸片一样飞出，"
        "前方有一台摄像机，AI视频创作氛围",
    ),
    (
        "cv-workshop",
        "桌面上摊开一份简历文档，一支钢笔正在上面书写，"
        "旁边浮着排版参考线和几块内容卡片，办公专业氛围",
    ),
    (
        "exprtrain",
        "一个麦克风立在画面中央，周围的语音波形逐渐变成字幕条，"
        "部分字幕被高亮圈出修正标记，口语训练氛围",
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

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = 0
    for slug, scene in PROJECTS:
        out = OUT_DIR / f"{slug}.jpg"
        print(f"[{slug}] 生成中…", flush=True)
        try:
            png = generate(key, scene)
            to_jpeg_16_10(png, out)
            size_kb = out.stat().st_size // 1024
            print(f"[{slug}] ✅ {out.relative_to(OUT_DIR.parent)} ({size_kb} KB)", flush=True)
        except Exception as e:  # noqa: BLE001 —— 单张失败不中断整批
            failed += 1
            print(f"[{slug}] ❌ {e}", flush=True)
        time.sleep(2)  # 尊重并发限制（文档建议 ≤3）

    print(f"\n完成：{len(PROJECTS) - failed}/{len(PROJECTS)} 张，目录 {OUT_DIR}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
