package com.example.generator.uml;

public class UmlMethodDTO {
  private String name;
  private String parameters;
  private String returnType;

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getParameters() { return parameters; }
  public void setParameters(String parameters) { this.parameters = parameters; }
  public String getReturnType() { return returnType; }
  public void setReturnType(String returnType) { this.returnType = returnType; }
}
