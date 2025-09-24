package com.example.generator.model;

import java.util.List;

public class EntityModel {
  private String name;
  private String table;
  private List<FieldModel> fields;
  private List<RelationModel> relations;
  private java.util.List<MethodModel> methods;

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getTable() { return table; }
  public void setTable(String table) { this.table = table; }
  public List<FieldModel> getFields() { return fields; }
  public void setFields(List<FieldModel> fields) { this.fields = fields; }
  public List<RelationModel> getRelations() { return relations; }
  public void setRelations(List<RelationModel> relations) { this.relations = relations; }
  public java.util.List<MethodModel> getMethods() { return methods; }
  public void setMethods(java.util.List<MethodModel> methods) { this.methods = methods; }
}
