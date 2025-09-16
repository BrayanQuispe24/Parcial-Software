package com.example.generator.model;

public class ProjectInfo {
  private String groupId;
  private String artifactId;
  private String packageBase;
  private String db;
  private String dbName;
  private String dbUser;
  private String dbPassword;

  public String getGroupId() { return groupId; }
  public void setGroupId(String groupId) { this.groupId = groupId; }
  public String getArtifactId() { return artifactId; }
  public void setArtifactId(String artifactId) { this.artifactId = artifactId; }
  public String getPackageBase() { return packageBase; }
  public void setPackageBase(String packageBase) { this.packageBase = packageBase; }
  public String getDb() { return db; }
  public void setDb(String db) { this.db = db; }
  public String getDbName() { return dbName; }
  public void setDbName(String dbName) { this.dbName = dbName; }
  public String getDbUser() { return dbUser; }
  public void setDbUser(String dbUser) { this.dbUser = dbUser; }
  public String getDbPassword() { return dbPassword; }
  public void setDbPassword(String dbPassword) { this.dbPassword = dbPassword; }
}
