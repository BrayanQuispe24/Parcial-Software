package com.example.generator.util;

import java.io.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class ZipUtil {

  public static ZipBuilder builder(OutputStream out) {
    return new ZipBuilder(out);
  }

  public static class ZipBuilder implements Closeable {
    private final ZipOutputStream zos;

    public ZipBuilder(OutputStream out) {
      this.zos = new ZipOutputStream(out);
    }

    public void addTextFile(String path, String content) throws IOException {
      ZipEntry entry = new ZipEntry(path);
      zos.putNextEntry(entry);
      zos.write(content.getBytes());
      zos.closeEntry();
    }

    @Override
    public void close() throws IOException {
      zos.close();
    }
  }
}
