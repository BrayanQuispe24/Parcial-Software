package com.example.generator.controller;

import com.example.generator.model.Diagram;
import com.example.generator.model.ProjectInfo;
import com.example.generator.service.CodeGenService;
import com.example.generator.service.UmlToDiagramMapper;
import com.example.generator.uml.UmlDiagramDTO;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/generate")
public class GenerationController {

  private final CodeGenService service;
  private final UmlToDiagramMapper mapper;

  public GenerationController(CodeGenService service, UmlToDiagramMapper mapper) {
    this.service = service;
    this.mapper = mapper;
  }

  // Formato canónico (Diagram)
  @PostMapping(produces = "application/zip")
  public ResponseEntity<ByteArrayResource> generate(@Validated @RequestBody Diagram diagram) {
    byte[] zip = service.generateZip(diagram);
    String filename = diagram.getProject().getArtifactId() + ".zip";
    return ResponseEntity.ok()
      .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
      .contentType(MediaType.parseMediaType("application/zip"))
      .contentLength(zip.length)
      .body(new ByteArrayResource(zip));
  }

  // Tu JSON UML
  @PostMapping(value="/uml", produces="application/zip")
  public ResponseEntity<ByteArrayResource> generateFromUml(
      @RequestBody UmlDiagramDTO uml,
      @RequestParam(name="groupId", defaultValue="com.acme") String groupId,
      @RequestParam(name="artifactId", defaultValue="generated-api") String artifactId,
      @RequestParam(name="packageBase", defaultValue="com.acme.generated") String packageBase,
      @RequestParam(name="db", defaultValue="h2") String db,
      @RequestParam(name="dbName", required=false) String dbName,
      @RequestParam(name="dbUser", required=false) String dbUser,
      @RequestParam(name="dbPassword", required=false) String dbPassword
  ) {
    ProjectInfo p = new ProjectInfo();
    p.setGroupId(groupId);
    p.setArtifactId(artifactId);
    p.setPackageBase(packageBase);
    p.setDb(db); p.setDbName(dbName); p.setDbUser(dbUser); p.setDbPassword(dbPassword);

    Diagram diagram = mapper.toDiagram(uml, p);
    byte[] zip = service.generateZip(diagram);
    return ResponseEntity.ok()
      .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + artifactId + ".zip\"")
      .contentType(MediaType.parseMediaType("application/zip"))
      .contentLength(zip.length)
      .body(new ByteArrayResource(zip));
  }
}
