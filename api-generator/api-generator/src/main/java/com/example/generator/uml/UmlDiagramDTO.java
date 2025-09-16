package com.example.generator.uml;
import java.util.List;

public class UmlDiagramDTO {
  private List<UmlClassDTO> classes;
  private List<UmlRelDTO> relationships;

  public List<UmlClassDTO> getClasses() { return classes; }
  public void setClasses(List<UmlClassDTO> classes) { this.classes = classes; }
  public List<UmlRelDTO> getRelationships() { return relationships; }
  public void setRelationships(List<UmlRelDTO> relationships) { this.relationships = relationships; }
}
