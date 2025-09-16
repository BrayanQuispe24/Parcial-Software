package com.example.generator.model;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public class Diagram {
  @NotNull
  private ProjectInfo project;
  @NotNull
  private List<EntityModel> entities;

  public ProjectInfo getProject() { return project; }
  public void setProject(ProjectInfo project) { this.project = project; }
  public List<EntityModel> getEntities() { return entities; }
  public void setEntities(List<EntityModel> entities) { this.entities = entities; }
}
