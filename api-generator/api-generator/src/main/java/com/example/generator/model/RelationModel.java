package com.example.generator.model;

public class RelationModel {

  private RelationType type;
  private String target;

  private String mappedBy;     // inverso (OneToMany/OneToOne/ManyToMany)
  private String joinColumn;   // propietario (ManyToOne/OneToOne)
  private String joinTable;    // propietario ManyToMany
  private String thisJoin;     // opcional (si quieres personalizar columnas)
  private String otherJoin;    // opcional

  // flags para composición/agregación
  private boolean cascadeAll;
  private boolean orphanRemoval;

  public RelationType getType() { return type; }
  public void setType(RelationType type) { this.type = type; }

  public String getTarget() { return target; }
  public void setTarget(String target) { this.target = target; }

  public String getMappedBy() { return mappedBy; }
  public void setMappedBy(String mappedBy) { this.mappedBy = mappedBy; }

  public String getJoinColumn() { return joinColumn; }
  public void setJoinColumn(String joinColumn) { this.joinColumn = joinColumn; }

  public String getJoinTable() { return joinTable; }
  public void setJoinTable(String joinTable) { this.joinTable = joinTable; }

  public String getThisJoin() { return thisJoin; }
  public void setThisJoin(String thisJoin) { this.thisJoin = thisJoin; }

  public String getOtherJoin() { return otherJoin; }
  public void setOtherJoin(String otherJoin) { this.otherJoin = otherJoin; }

  public boolean isCascadeAll() { return cascadeAll; }
  public void setCascadeAll(boolean cascadeAll) { this.cascadeAll = cascadeAll; }

  public boolean isOrphanRemoval() { return orphanRemoval; }
  public void setOrphanRemoval(boolean orphanRemoval) { this.orphanRemoval = orphanRemoval; }
}
