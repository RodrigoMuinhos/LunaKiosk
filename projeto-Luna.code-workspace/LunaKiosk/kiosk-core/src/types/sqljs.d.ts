declare module 'sql.js' {
  export type SqlJsStatic = any;
  export type Database = any;
  const initSqlJs: (config?: any) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
