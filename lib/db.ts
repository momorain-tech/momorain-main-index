import mysql from "mysql2/promise"

// Next.js dev 模式下热更新会重复加载模块，用 global 变量避免创建过多连接
// 生产模式下模块只加载一次，直接用模块级变量即可
declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    // mysql2 默认把 JSON 列当字符串返回，这里让它自动 parse 成对象
    typeCast(field, next) {
      if (field.type === "JSON") return JSON.parse(field.string("utf8") as string)
      return next()
    },
  })
}

export function getPool(): mysql.Pool {
  return (global._mysqlPool ??= createPool())
}

// 判断 DB 环境变量是否配置齐全（未配置时读取方走静态 fallback，写入方直接报错）
export function isDbConfigured(): boolean {
  return !!(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD &&
    process.env.DB_NAME
  )
}

// 便捷查询函数，调用方不用手动处理 pool.execute 的返回值结构
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T>(sql: string, values?: any[]): Promise<T[]> {
  const [rows] = await getPool().execute(sql, values)
  return rows as T[]
}
