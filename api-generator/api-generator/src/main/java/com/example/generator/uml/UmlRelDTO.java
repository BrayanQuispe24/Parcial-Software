package com.example.generator.uml;

public class UmlRelDTO {
  private String id;
  private String sourceId;
  private String targetId;
  private String sourceName;
  private String targetName;
  private String type;
  private UmlCardinalityDTO cardinality;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getSourceId() { return sourceId; }
  public void setSourceId(String sourceId) { this.sourceId = sourceId; }
  public String getTargetId() { return targetId; }
  public void setTargetId(String targetId) { this.targetId = targetId; }
  public String getSourceName() { return sourceName; }
  public void setSourceName(String sourceName) { this.sourceName = sourceName; }
  public String getTargetName() { return targetName; }
  public void setTargetName(String targetName) { this.targetName = targetName; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public UmlCardinalityDTO getCardinality() { return cardinality; }
  public void setCardinality(UmlCardinalityDTO cardinality) { this.cardinality = cardinality; }
}
