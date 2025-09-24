package com.example.generator.model;

public class MethodModel {
    private String name;
    private String returnType;  // tipo Java mapeado (String, Integer, etc.)
    private String paramsSig;   // firma "Tipo nombre, Tipo2 nombre2"
    private boolean hasReturn;  // true si no es void
    private String returnExpr;  // expresión por defecto: "", 0, 0L, false, etc.

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getReturnType() { return returnType; }
    public void setReturnType(String returnType) { this.returnType = returnType; }
    public String getParamsSig() { return paramsSig; }
    public void setParamsSig(String paramsSig) { this.paramsSig = paramsSig; }
    public boolean isHasReturn() { return hasReturn; }
    public void setHasReturn(boolean hasReturn) { this.hasReturn = hasReturn; }
    public String getReturnExpr() { return returnExpr; }
    public void setReturnExpr(String returnExpr) { this.returnExpr = returnExpr; }
}
