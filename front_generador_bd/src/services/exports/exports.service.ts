import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ExportsService {

  constructor() { }

  umlToSQL(
    classes: any[],
    relationships: any[],
    dbName: string = "mi_proyecto_db"
  ): string {
    let sql: string[] = [];

    // Crear la base
    sql.push(`CREATE DATABASE ${dbName};`);
    sql.push(`\\c ${dbName};\n`); // Postgres usa \c en lugar de USE

    const tables: Record<string, { name: string; pk: string }> = {};

    // 1. Clases -> tablas
    for (const c of classes) {
      let cols: string[] = [];
      let pk = "id";

      for (const attr of c.attributes) {
        const isPrimary = attr.name.toLowerCase() === "id";
        const typ = this.mapTypeToPostgres(attr.type, isPrimary);

        if (isPrimary) {
          cols.push(`${attr.name} ${typ} PRIMARY KEY`);
          pk = attr.name;
        } else {
          cols.push(`${attr.name} ${typ}`);
        }
      }

      tables[c.id] = { name: c.name.toLowerCase(), pk };
      sql.push(`CREATE TABLE ${c.name.toLowerCase()} (\n  ${cols.join(",\n  ")}\n);`);
    }

    // 2. Relaciones
    for (const r of relationships) {
      const src = tables[r.sourceId].name;
      const tgt = tables[r.targetId].name;
      const pkSrc = tables[r.sourceId].pk;

      if (r.type === "generalization") {
        sql.push(
          `ALTER TABLE ${tgt} ADD CONSTRAINT fk_${tgt}_${src} FOREIGN KEY(${pkSrc}) REFERENCES ${src}(${pkSrc});`
        );
      }
      if (r.type === "association" || r.type === "aggregation") {
        sql.push(
          `ALTER TABLE ${tgt} ADD COLUMN ${src}_id INT, ADD CONSTRAINT fk_${tgt}_${src} FOREIGN KEY(${src}_id) REFERENCES ${src}(${pkSrc});`
        );
      }
      if (r.type === "composition") {
        sql.push(
          `ALTER TABLE ${tgt} ADD COLUMN ${src}_id INT, ADD CONSTRAINT fk_${tgt}_${src} FOREIGN KEY(${src}_id) REFERENCES ${src}(${pkSrc}) ON DELETE CASCADE;`
        );
      }
    }

    return sql.join("\n\n");
  }

  private mapTypeToPostgres(umlType: string, isPrimaryKey: boolean = false): string {
    if (!umlType) {
      return isPrimaryKey ? "SERIAL" : "VARCHAR(255)";
    }

    switch (umlType.toLowerCase()) {
      case "string": return "VARCHAR(255)";
      case "number": return isPrimaryKey ? "SERIAL" : "INT";
      case "int": return isPrimaryKey ? "SERIAL" : "INT";
      case "bigint": return "BIGINT";
      case "float": return "REAL";
      case "double": return "DOUBLE PRECISION";
      case "boolean": return "BOOLEAN";
      case "date": return "TIMESTAMP";
      case "any": return "JSONB";
      case "object": return "JSONB";
      default: return "VARCHAR(255)"; // fallback
    }
  }

}
