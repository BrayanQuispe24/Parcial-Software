package com.example.generator.model;

public class FieldModel {
  private String name;
  private String type;
  private boolean id;
  private boolean nullable = true;
  private boolean unique = false;

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public boolean isId() { return id; }
  public void setId(boolean id) { this.id = id; }
  public boolean isNullable() { return nullable; }
  public void setNullable(boolean nullable) { this.nullable = nullable; }
  public boolean isUnique() { return unique; }
  public void setUnique(boolean unique) { this.unique = unique; }
}
