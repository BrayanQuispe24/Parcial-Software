package com.example.generator.uml;
import java.util.List;

public class UmlClassDTO {
  private String id;
  private String name;
  private List<UmlAttributeDTO> attributes;
  private List<UmlMethodDTO> methods;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public List<UmlAttributeDTO> getAttributes() { return attributes; }
  public void setAttributes(List<UmlAttributeDTO> attributes) { this.attributes = attributes; }
  public List<UmlMethodDTO> getMethods() { return methods; }
  public void setMethods(List<UmlMethodDTO> methods) { this.methods = methods; }
}
