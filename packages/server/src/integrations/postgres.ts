import {
  Integration,
  DatasourceFieldTypes,
  QueryTypes,
  QueryJson,
  SqlQuery,
} from "../definitions/datasource"
import { Table } from "../definitions/common"
import { getSqlQuery } from "./utils"

module PostgresModule {
  const { Pool } = require("pg")
  const Sql = require("./base/sql")
  const { FieldTypes } = require("../constants")
  const {
    buildExternalTableId,
    convertType,
    copyExistingPropsOver,
  } = require("./utils")
  const { escapeDangerousCharacters } = require("../utilities")

  const JSON_REGEX = /'{.*}'::json/s

  interface PostgresConfig {
    host: string
    port: number
    database: string
    user: string
    password: string
    ssl?: boolean
    ca?: string
    rejectUnauthorized?: boolean
  }

  const SCHEMA: Integration = {
    docs: "https://node-postgres.com",
    plus: true,
    friendlyName: "PostgreSQL",
    description:
      "PostgreSQL, also known as Postgres, is a free and open-source relational database management system emphasizing extensibility and SQL compliance.",
    datasource: {
      host: {
        type: DatasourceFieldTypes.STRING,
        default: "localhost",
        required: true,
      },
      port: {
        type: DatasourceFieldTypes.NUMBER,
        required: true,
        default: 5432,
      },
      database: {
        type: DatasourceFieldTypes.STRING,
        default: "postgres",
        required: true,
      },
      user: {
        type: DatasourceFieldTypes.STRING,
        default: "root",
        required: true,
      },
      password: {
        type: DatasourceFieldTypes.PASSWORD,
        default: "root",
        required: true,
      },
      ssl: {
        type: DatasourceFieldTypes.BOOLEAN,
        default: false,
        required: false,
      },
      rejectUnauthorized: {
        type: DatasourceFieldTypes.BOOLEAN,
        default: false,
        required: false,
      },
      ca: {
        type: DatasourceFieldTypes.LONGFORM,
        default: false,
        required: false,
      },
    },
    query: {
      create: {
        type: QueryTypes.SQL,
      },
      read: {
        type: QueryTypes.SQL,
      },
      update: {
        type: QueryTypes.SQL,
      },
      delete: {
        type: QueryTypes.SQL,
      },
    },
  }

  const TYPE_MAP = {
    text: FieldTypes.LONGFORM,
    varchar: FieldTypes.STRING,
    integer: FieldTypes.NUMBER,
    bigint: FieldTypes.NUMBER,
    decimal: FieldTypes.NUMBER,
    smallint: FieldTypes.NUMBER,
    real: FieldTypes.NUMBER,
    "double precision": FieldTypes.NUMBER,
    timestamp: FieldTypes.DATETIME,
    time: FieldTypes.DATETIME,
    boolean: FieldTypes.BOOLEAN,
    json: FieldTypes.JSON,
    date: FieldTypes.DATETIME,
  }

  async function internalQuery(client: any, query: SqlQuery) {
    // need to handle a specific issue with json data types in postgres,
    // new lines inside the JSON data will break it
    if (query && query.sql) {
      const matches = query.sql.match(JSON_REGEX)
      if (matches && matches.length > 0) {
        for (let match of matches) {
          const escaped = escapeDangerousCharacters(match)
          query.sql = query.sql.replace(match, escaped)
        }
      }
    }
    try {
      return await client.query(query.sql, query.bindings || [])
    } catch (err) {
      // @ts-ignore
      throw new Error(err)
    }
  }

  class PostgresIntegration extends Sql {
    static pool: any
    private readonly client: any
    private readonly config: PostgresConfig

    COLUMNS_SQL =
      "select * from information_schema.columns where not table_schema = 'information_schema' and not table_schema = 'pg_catalog'"

    PRIMARY_KEYS_SQL = `
    select tc.table_schema, tc.table_name, kc.column_name as primary_key 
    from information_schema.table_constraints tc
    join 
      information_schema.key_column_usage kc on kc.table_name = tc.table_name 
      and kc.table_schema = tc.table_schema 
      and kc.constraint_name = tc.constraint_name
    where tc.constraint_type = 'PRIMARY KEY';
    `

    constructor(config: PostgresConfig) {
      super("pg")
      this.config = config

      let newConfig = {
        ...this.config,
        ssl: this.config.ssl
          ? {
              rejectUnauthorized: this.config.rejectUnauthorized,
              ca: this.config.ca,
            }
          : undefined,
      }
      if (!this.pool) {
        this.pool = new Pool(newConfig)
      }

      this.client = this.pool
    }

    /**
     * Fetches the tables from the postgres table and assigns them to the datasource.
     * @param {*} datasourceId - datasourceId to fetch
     * @param entities - the tables that are to be built
     */
    async buildSchema(datasourceId: string, entities: Record<string, Table>) {
      let tableKeys: { [key: string]: string[] } = {}
      try {
        const primaryKeysResponse = await this.client.query(
          this.PRIMARY_KEYS_SQL
        )
        for (let table of primaryKeysResponse.rows) {
          const tableName = table.table_name
          if (!tableKeys[tableName]) {
            tableKeys[tableName] = []
          }
          const key = table.column_name || table.primary_key
          // only add the unique keys
          if (key && tableKeys[tableName].indexOf(key) === -1) {
            tableKeys[tableName].push(key)
          }
        }
      } catch (err) {
        tableKeys = {}
      }

      const columnsResponse = await this.client.query(this.COLUMNS_SQL)
      const tables: { [key: string]: Table } = {}

      for (let column of columnsResponse.rows) {
        const tableName: string = column.table_name
        const columnName: string = column.column_name

        // table key doesn't exist yet
        if (!tables[tableName] || !tables[tableName].schema) {
          tables[tableName] = {
            _id: buildExternalTableId(datasourceId, tableName),
            primary: tableKeys[tableName] || ["id"],
            name: tableName,
            schema: {},
          }
        }

        const type: string = convertType(column.data_type, TYPE_MAP)
        const identity = !!(
          column.identity_generation ||
          column.identity_start ||
          column.identity_increment
        )
        const hasDefault =
          typeof column.column_default === "string" &&
          column.column_default.startsWith("nextval")
        const isGenerated =
          column.is_generated && column.is_generated !== "NEVER"
        const isAuto: boolean = hasDefault || identity || isGenerated
        tables[tableName].schema[columnName] = {
          autocolumn: isAuto,
          name: columnName,
          type,
        }
      }

      for (let tableName of Object.keys(tables)) {
        copyExistingPropsOver(tableName, tables, entities)
      }
      this.tables = tables
    }

    async create(query: SqlQuery | string) {
      const response = await internalQuery(this.client, getSqlQuery(query))
      return response.rows.length ? response.rows : [{ created: true }]
    }

    async read(query: SqlQuery | string) {
      const response = await internalQuery(this.client, getSqlQuery(query))
      return response.rows
    }

    async update(query: SqlQuery | string) {
      const response = await internalQuery(this.client, getSqlQuery(query))
      return response.rows.length ? response.rows : [{ updated: true }]
    }

    async delete(query: SqlQuery | string) {
      const response = await internalQuery(this.client, getSqlQuery(query))
      return response.rows.length ? response.rows : [{ deleted: true }]
    }

    async query(json: QueryJson) {
      const operation = this._operation(json).toLowerCase()
      const input = this._query(json)
      const response = await internalQuery(this.client, input)
      return response.rows.length ? response.rows : [{ [operation]: true }]
    }
  }

  module.exports = {
    schema: SCHEMA,
    integration: PostgresIntegration,
  }
}
