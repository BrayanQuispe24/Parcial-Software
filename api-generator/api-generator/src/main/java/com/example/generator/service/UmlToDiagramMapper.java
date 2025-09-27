package com.example.generator.service;

import com.example.generator.model.*;
import com.example.generator.uml.*;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class UmlToDiagramMapper {

  public Diagram toDiagram(UmlDiagramDTO uml, ProjectInfo p) {
    Diagram d = new Diagram();
    d.setProject(p);

    Map<String, UmlClassDTO> byId = uml.getClasses().stream()
            .collect(Collectors.toMap(UmlClassDTO::getId, c -> c));

    // 1) Entidades base
    Map<String, EntityModel> entities = new LinkedHashMap<>();
    for (UmlClassDTO c : uml.getClasses()) {
      EntityModel e = new EntityModel();
      e.setName(normalizeName(c.getName()));
      e.setTable(toTableName(c.getName()));
      e.setFields(buildFields(c));
      e.setMethods(buildMethods(c));
      entities.put(c.getId(), e);
    }

    // 2) Join entities explícitas (nombres con "_", p. ej. Persona_Gato)
    Set<String> associativeIds = detectAssociatives(uml);

    // 3) Relaciones
    for (UmlRelDTO r : uml.getRelationships()) {
      UmlClassDTO src = byId.get(r.getSourceId());
      UmlClassDTO tgt = byId.get(r.getTargetId());
      if (src == null || tgt == null) continue;

      String srcName = normalizeName(src.getName());
      String tgtName = normalizeName(tgt.getName());

      Multiplicity mSrc = parseMultiplicity(r.getCardinality() != null ? r.getCardinality().getSource() : null);
      Multiplicity mTgt = parseMultiplicity(r.getCardinality() != null ? r.getCardinality().getTarget() : null);
      // 🔹 Generalización (herencia)
      if ("generalization".equalsIgnoreCase(r.getType())) {
        EntityModel child = entities.get(r.getSourceId());
        EntityModel parent = entities.get(r.getTargetId());

        if (child != null && parent != null) {
          child.setExtendsName(tgtName);

          if (parent.getChildren() == null) {
            parent.setChildren(new ArrayList<>());
          }
          parent.getChildren().add(srcName);
        }
        continue;
      }


      // Join-entity explícita → modelar como 1..N alrededor de la join
      if (associativeIds.contains(r.getTargetId())) {
        EntityModel joinE = entities.get(r.getTargetId());
        addManyToOne(joinE, srcName, toFk(srcName));
        addOneToMany(entities.get(r.getSourceId()), joinE.getName(), lower(srcName));
        continue;
      }
      if (associativeIds.contains(r.getSourceId())) {
        EntityModel joinE = entities.get(r.getSourceId());
        addManyToOne(joinE, tgtName, toFk(tgtName));
        addOneToMany(entities.get(r.getTargetId()), joinE.getName(), lower(tgtName));
        continue;
      }

      // Si no hay cardinalidades claras, aún podemos usar el tipo
      String relType = r.getType() != null ? r.getType().toLowerCase(Locale.ROOT) : "association";

      // composition / aggregation → 1..N ; composition con cascade+orphan
      if ("composition".equals(relType) || "aggregation".equals(relType)) {
        EntityModel child  = entities.get(r.getSourceId());
        EntityModel parent = entities.get(r.getTargetId());
        addManyToOne(child, tgtName, toFk(tgtName));
        RelationModel onm = addOneToMany(parent, child.getName(), lower(tgtName));
        if ("composition".equals(relType)) { onm.setCascadeAll(true); onm.setOrphanRemoval(true); }
        continue;
      }

      // dependency → N..1 "suave" (sin cascada / orphan)
      if ("dependency".equals(relType)) {
        addManyToOne(entities.get(r.getSourceId()), tgtName, toFk(tgtName));
        addOneToMany(entities.get(r.getTargetId()), entities.get(r.getSourceId()).getName(), lower(tgtName));
        continue;
      }

      // Si sí hay cardinalidades:
      if (mSrc == Multiplicity.UNKNOWN || mTgt == Multiplicity.UNKNOWN) {
        continue;
      }

      // 1 ↔ 1
      if (isOne(mSrc) && isOne(mTgt)) {
        EntityModel srcE = entities.get(r.getSourceId()); // owner = source
        EntityModel tgtE = entities.get(r.getTargetId()); // inverse
        addOneToOneOwning(srcE, tgtName, toFk(tgtName));      // owner = source, campo en owner: lower(tgtName)
        addOneToOneInverse(tgtE, srcName, tgtName);           // inverse: target = srcName, mappedBy = lower(tgtName)
        continue;
      }

      // * ↔ *
      if (isMany(mSrc) && isMany(mTgt)) {
        String jt = joinTable(srcName, tgtName);
        addManyToManyOwning(entities.get(r.getSourceId()), tgtName, jt);
        addManyToManyInverse(entities.get(r.getTargetId()), srcName);
        continue;
      }

      // N ↔ 1 (source N, target 1)
      if (isMany(mSrc) && isOne(mTgt)) {
        addManyToOne(entities.get(r.getSourceId()), tgtName, toFk(tgtName));
        addOneToMany(entities.get(r.getTargetId()), entities.get(r.getSourceId()).getName(), lower(tgtName));
        continue;
      }

      // 1 ↔ N (source 1, target N)
      if (isOne(mSrc) && isMany(mTgt)) {
        addManyToOne(entities.get(r.getTargetId()), srcName, toFk(srcName));
        addOneToMany(entities.get(r.getSourceId()), entities.get(r.getTargetId()).getName(), lower(srcName));
        continue;
      }
    }

    d.setEntities(new ArrayList<>(entities.values()));
    return d;
  }

  // ---------- campos ----------

  private List<FieldModel> buildFields(UmlClassDTO c) {
    Map<String, FieldModel> unique = new LinkedHashMap<>();
    if (c.getAttributes() != null) {
      for (UmlAttributeDTO a : c.getAttributes()) {
        if (a.getName() == null || a.getName().isBlank()) continue;
        String name = sanitize(a.getName());

        // 🚫 Ignorar atributos que parezcan FK (terminen en "_id")
        if (name.toLowerCase().endsWith("_id")) continue;

        unique.putIfAbsent(name, mkField(name, a.getType()));
      }
    }
    boolean hasId = unique.values().stream().anyMatch(FieldModel::isId);
    if (!hasId) {
      FieldModel id = new FieldModel();
      id.setName("id");
      id.setType("Long");
      id.setId(true);
      id.setNullable(false);
      unique.put("id", id);
    }
    return new ArrayList<>(unique.values());
  }


  private FieldModel mkField(String name, String rawType) {
    FieldModel f = new FieldModel();
    f.setName(sanitize(name));
    f.setType(mapType(rawType, name));
    f.setNullable(true);
    f.setUnique(false);
    if ("id".equalsIgnoreCase(name)) { f.setId(true); f.setNullable(false); }
    return f;
  }

  private String mapType(String t, String name) {
    if (t == null) return "String";
    String tl = t.toLowerCase(Locale.ROOT);
    if (tl.equals("int") || tl.equals("integer")) return "id".equalsIgnoreCase(name) ? "Long" : "Integer";
    if (tl.equals("long")) return "Long";
    if (tl.equals("double")) return "Double";
    if (tl.equals("string")) return "String";
    if (tl.equals("boolean")) return "Boolean";
    return "String";
  }

  // ---------- relaciones ----------

  private void addManyToOne(EntityModel owner, String targetName, String joinCol) {
    RelationModel r = new RelationModel();
    r.setType(RelationType.MANY_TO_ONE);
    r.setTarget(targetName);
    r.setJoinColumn(joinCol);
    owner.setRelations(append(owner.getRelations(), r));

    // 🚫 No crear FieldModel para joinCol
  }


  private RelationModel addOneToMany(EntityModel one, String targetName, String mappedByVar) {
    RelationModel r = new RelationModel();
    r.setType(RelationType.ONE_TO_MANY);
    r.setTarget(targetName);
    r.setMappedBy(mappedByVar);
    one.setRelations(append(one.getRelations(), r));
    return r;
  }

  // OneToOne → lado propietario, solo relación
  private void addOneToOneOwning(EntityModel owner, String targetName, String joinCol) {
    RelationModel r = new RelationModel();
    r.setType(RelationType.ONE_TO_ONE);
    r.setTarget(targetName);
    r.setJoinColumn(joinCol);
    owner.setRelations(append(owner.getRelations(), r));
  }

  // Reemplaza el método existente por:
  private void addOneToOneInverse(EntityModel inverse, String ownerSimpleName, String ownerFieldTargetName) {
    RelationModel r = new RelationModel();
    r.setType(RelationType.ONE_TO_ONE);
    r.setTarget(ownerSimpleName);              // la clase del otro lado (el owner)
    r.setMappedBy(lower(ownerFieldTargetName)); // nombre del campo en el owner (p.ej. "persona")
    inverse.setRelations(append(inverse.getRelations(), r));
  }


  private void addManyToManyOwning(EntityModel owner, String targetName, String joinTable) {
    RelationModel r = new RelationModel();
    r.setType(RelationType.MANY_TO_MANY);
    r.setTarget(targetName);
    r.setJoinTable(joinTable);
    owner.setRelations(append(owner.getRelations(), r));
  }

  private void addManyToManyInverse(EntityModel inverse, String ownerSimpleName) {
    RelationModel r = new RelationModel();
    r.setType(RelationType.MANY_TO_MANY);
    r.setTarget(ownerSimpleName);
    r.setMappedBy(lower(ownerSimpleName));
    inverse.setRelations(append(inverse.getRelations(), r));
  }

  private <T> List<T> append(List<T> list, T item) {
    List<T> out = list == null ? new ArrayList<>() : new ArrayList<>(list);
    out.add(item);
    return out;
  }

  // ---------- multiplicidades ----------

  enum Multiplicity { ZERO_OR_ONE, ONE, MANY, UNKNOWN }

  private Multiplicity parseMultiplicity(String s) {
    if (s == null || s.isBlank()) return Multiplicity.UNKNOWN;
    String x = s.trim();
    if (x.equals("1")) return Multiplicity.ONE;
    if (x.equals("*") || x.equals("0..*") || x.equals("1..*")) return Multiplicity.MANY;
    if (x.equals("0..1")) return Multiplicity.ZERO_OR_ONE;
    return Multiplicity.UNKNOWN;
  }

  private boolean isOne(Multiplicity m) { return m == Multiplicity.ONE || m == Multiplicity.ZERO_OR_ONE; }
  private boolean isMany(Multiplicity m) { return m == Multiplicity.MANY; }

  // ---------- util ----------

  private String sanitize(String n) { return n.replaceAll("[^A-Za-z0-9_]", "_"); }

  private String normalizeName(String n) {
    String[] parts = n.split("[_\\s]+");
    StringBuilder sb = new StringBuilder();
    for (String p : parts) {
      if (p.isBlank()) continue;
      sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
    }
    return sb.toString();
  }

  private String toTableName(String n) {
    return n.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "_");
  }

  private String lower(String n) { return Character.toLowerCase(n.charAt(0)) + n.substring(1); }

  private String toFk(String simple) { return lower(simple) + "_id"; }

  private String joinTable(String a, String b) { return (a + "_" + b).toLowerCase(Locale.ROOT); }

  private Set<String> detectAssociatives(UmlDiagramDTO uml) {
    Set<String> byName = new HashSet<>();
    for (UmlClassDTO c : uml.getClasses()) {
      if (c.getName() != null && c.getName().contains("_")) {
        byName.add(c.getId());
      }
    }
    return byName;
  }
  private java.util.List<MethodModel> buildMethods(UmlClassDTO c) {
    java.util.List<MethodModel> out = new java.util.ArrayList<>();
    if (c.getMethods() == null) return out;

    for (UmlMethodDTO m : c.getMethods()) {
      if (m.getName() == null || m.getName().isBlank()) continue;

      String rt = (m.getReturnType() == null || m.getReturnType().isBlank())
              ? "void"
              : mapType(m.getReturnType(), m.getName());

      String paramsSig = makeParamsSig(m.getParameters());

      MethodModel mm = new MethodModel();
      mm.setName(sanitize(m.getName()));
      mm.setReturnType(rt);
      boolean hasReturn = !"void".equals(rt);
      mm.setHasReturn(hasReturn);
      mm.setReturnExpr(hasReturn ? defaultReturnExpr(rt) : null);
      mm.setParamsSig(paramsSig);

      out.add(mm);
    }
    return out;
  }

  private String makeParamsSig(String raw) {
    if (raw == null || raw.isBlank()) return "";
    String[] parts = raw.split(",");
    java.util.List<String> sig = new java.util.ArrayList<>();
    for (String p : parts) {
      String s = p.trim();
      if (s.isEmpty()) continue;
      String name = s;
      String type = "String";
      int idx = s.indexOf(':');
      if (idx > 0) {
        name = s.substring(0, idx).trim();
        type = s.substring(idx + 1).trim();
      }
      String javaType = mapType(type, name);
      sig.add(javaType + " " + lower(name));
    }
    return String.join(", ", sig);
  }

  private String defaultReturnExpr(String javaType) {
    switch (javaType) {
      case "String": return "\"\"";
      case "Integer": return "0";
      case "Long": return "0L";
      case "Double": return "0.0";
      case "Boolean": return "false";
      default:
        // Para tipos no primitivos, intenta "null"
        return "null";
    }
  }

}
