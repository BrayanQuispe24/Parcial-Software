package com.example.generator.service;

import com.example.generator.model.*;
import com.example.generator.util.ZipUtil;
import com.github.mustachejava.DefaultMustacheFactory;
import com.github.mustachejava.Mustache;
import com.github.mustachejava.MustacheFactory;
import org.apache.commons.io.FilenameUtils;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class CodeGenService {

  private final MustacheFactory mf = new DefaultMustacheFactory();

  public byte[] generateZip(Diagram diagram) {
    Map<String, Object> baseCtx = buildBaseContext(diagram);

    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try (ZipUtil.ZipBuilder zip = ZipUtil.builder(out)) {

      // raíz del proyecto generado
      renderToZip(zip, "templates/generated-app/pom.xml.mustache",
          path(diagram, "pom.xml"), baseCtx);

      renderToZip(zip, "templates/generated-app/src/main/resources/application.properties.mustache",
          path(diagram, "src/main/resources/application.properties"), baseCtx);

      // Plantillas estáticas (blueprints)
      final String TPL = "templates/generated-app/blueprints/";
      String pkg = pkgPath(diagram);

      renderToZip(zip, TPL + "Application.java.mustache",
          path(diagram, "src/main/java/" + pkg + "/Application.java"), baseCtx);

      for (EntityModel e : diagram.getEntities()) {
        Map<String, Object> entityCtx = buildEntityContext(diagram, e, baseCtx);

        renderToZip(zip, TPL + "Entity.java.mustache",
            path(diagram, "src/main/java/" + pkg + "/domain/" + e.getName() + ".java"), entityCtx);

        renderToZip(zip, TPL + "Repository.java.mustache",
            path(diagram, "src/main/java/" + pkg + "/repository/" + e.getName() + "Repository.java"), entityCtx);

        renderToZip(zip, TPL + "Service.java.mustache",
            path(diagram, "src/main/java/" + pkg + "/service/" + e.getName() + "Service.java"), entityCtx);

        renderToZip(zip, TPL + "Controller.java.mustache",
            path(diagram, "src/main/java/" + pkg + "/web/" + e.getName() + "Controller.java"), entityCtx);
      }

    } catch (IOException ex) {
      throw new RuntimeException("Error generando ZIP", ex);
    }
    return out.toByteArray();
  }

  private Map<String, Object> buildBaseContext(Diagram d) {
    ProjectInfo p = d.getProject();
    Map<String, Object> ctx = new HashMap<>();
    ctx.put("groupId", p.getGroupId());
    ctx.put("artifactId", p.getArtifactId());
    ctx.put("packageBase", p.getPackageBase());
    ctx.put("packagePath", p.getPackageBase().replace('.', '/'));

    String db = Optional.ofNullable(p.getDb()).orElse("h2").toLowerCase(Locale.ROOT);
    ctx.put("db_h2", "h2".equals(db));
    ctx.put("db_postgres", "postgres".equals(db) || "postgresql".equals(db));
    ctx.put("db_mysql", "mysql".equals(db));
    ctx.put("dbName", p.getDbName());
    ctx.put("dbUser", p.getDbUser());
    ctx.put("dbPassword", p.getDbPassword());
    return ctx;
  }

  private Map<String, Object> buildEntityContext(Diagram d, EntityModel e, Map<String, Object> base) {
    Map<String, Object> m = new HashMap<>(base);
    m.put("name", e.getName());
    m.put("varName", lowerFirst(e.getName()));
    m.put("table", e.getTable() != null ? e.getTable() : e.getName().toLowerCase(Locale.ROOT));

    List<Map<String, Object>> fields = new ArrayList<>();
    if (e.getFields() != null) {
      for (FieldModel f : e.getFields()) {
        Map<String, Object> fm = new HashMap<>();
        fm.put("name", f.getName());
        fm.put("type", mapType(f.getType()));
        fm.put("isId", f.isId());
        fm.put("nullable", f.isNullable());
        fm.put("unique", f.isUnique());
        fm.put("Name", upperFirst(f.getName()));
        fields.add(fm);
        }
    }
    m.put("fields", fields);
    // Métodos
    List<Map<String, Object>> methods = new ArrayList<>();
    if (e.getMethods() != null) {
      for (com.example.generator.model.MethodModel mm : e.getMethods()) {
        Map<String, Object> mth = new HashMap<>();
        mth.put("name", mm.getName());
        mth.put("returnType", mm.getReturnType());
        mth.put("paramsSig", mm.getParamsSig());
        mth.put("hasReturn", mm.isHasReturn());
        mth.put("returnExpr", mm.getReturnExpr());
        methods.add(mth);
      }
    }
    m.put("methods", methods);


    List<Map<String, Object>> oneToMany = new ArrayList<>();
    List<Map<String, Object>> manyToOne = new ArrayList<>();
    List<Map<String,Object>> oneToOneOwning = new ArrayList<>();
    List<Map<String,Object>> oneToOneInverse = new ArrayList<>();
    List<Map<String,Object>> manyToManyOwning = new ArrayList<>();
    List<Map<String,Object>> manyToManyInverse = new ArrayList<>();

    if (e.getRelations() != null) {
      for (RelationModel r : e.getRelations()) {
        Map<String, Object> rm = new HashMap<>();
        String _tv = lowerFirst(r.getTarget());
        rm.put("target", r.getTarget());
        rm.put("targetVar", _tv);
        rm.put("targetVarCap", upperFirst(_tv));
        rm.put("mappedBy", r.getMappedBy());
        rm.put("joinColumn", r.getJoinColumn());
        rm.put("joinTable", r.getJoinTable());
        rm.put("thisJoin", r.getThisJoin());
        rm.put("otherJoin", r.getOtherJoin());
        rm.put("cascadeAll", r.isCascadeAll());
        rm.put("orphanRemoval", r.isOrphanRemoval());
        rm.put("jsonRef", refKey(e.getName(), r.getTarget())); // <= CLAVE ESTABLE

        switch (r.getType()) {
          case ONE_TO_MANY -> oneToMany.add(rm);
          case MANY_TO_ONE -> manyToOne.add(rm);
          case ONE_TO_ONE  -> {
            if (r.getMappedBy() != null && !r.getMappedBy().isBlank()) oneToOneInverse.add(rm);
            else oneToOneOwning.add(rm);
          }
          case MANY_TO_MANY -> {
            if (r.getMappedBy() != null && !r.getMappedBy().isBlank()) manyToManyInverse.add(rm);
            else manyToManyOwning.add(rm);
          }
        }

      }
    }
    m.put("oneToMany", oneToMany);
    m.put("manyToOne", manyToOne);
    m.put("oneToOneOwning", oneToOneOwning);
    m.put("oneToOneInverse", oneToOneInverse);
    m.put("manyToManyOwning", manyToManyOwning);
    m.put("manyToManyInverse", manyToManyInverse);

    // 🔹 Herencia (generalization)
    m.put("parentName", e.getExtendsName());
    m.put("isChild", e.getExtendsName() != null);

    boolean isParent = e.getChildren() != null && !e.getChildren().isEmpty();
    m.put("isParent", isParent);

    return m;
  }

  
  private String upperFirst(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toUpperCase(s.charAt(0)) + s.substring(1);
  }

  private String lowerFirst(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toLowerCase(s.charAt(0)) + s.substring(1);
  }
  private String refKey(String a, String b) {
    String x = a == null ? "" : a.toLowerCase(java.util.Locale.ROOT);
    String y = b == null ? "" : b.toLowerCase(java.util.Locale.ROOT);
    return x.compareTo(y) <= 0 ? x + "-" + y : y + "-" + x;
  }


  private String mapType(String t) {
    if (t == null) return "String";
    switch (t) {
      case "long": case "Long": return "Long";
      case "int": case "Integer": return "Integer";
      case "double": case "Double": return "Double";
      case "bigdecimal": case "BigDecimal": return "java.math.BigDecimal";
      case "localdate": case "LocalDate": return "java.time.LocalDate";
      case "localdatetime": case "LocalDateTime": return "java.time.LocalDateTime";
      case "boolean": case "Boolean": return "Boolean";
      default: return "String";
    }
  }

  private String pkgPath(Diagram d) {
    return d.getProject().getPackageBase().replace('.', '/');
  }

  private String path(Diagram d, String relative) {
    String root = d.getProject().getArtifactId();
    return FilenameUtils.separatorsToUnix(root + "/" + relative);
  }

  private void renderToZip(ZipUtil.ZipBuilder zip, String classpathTpl, String outPath, Map<String, Object> ctx) throws IOException {
    try (InputStream in = getClass().getClassLoader().getResourceAsStream(classpathTpl)) {
      if (in == null) throw new FileNotFoundException("No se encontró plantilla: " + classpathTpl);
      String templateText = new String(in.readAllBytes(), StandardCharsets.UTF_8);
      Mustache m = mf.compile(new StringReader(templateText), classpathTpl);
      StringWriter sw = new StringWriter();
      m.execute(sw, ctx).flush();
      zip.addTextFile(outPath, sw.toString());
    }
  }
}
