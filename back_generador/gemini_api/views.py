from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .service.gemini_fixtures import generate_test_data_with_gemini, fixtures_to_sql


class FixtureGeneratorJSONView(APIView):
    """
    Genera datos de prueba en formato JSON (fixtures).
    """
    def post(self, request):
        diagram = request.data.get("diagram")
        count = request.data.get("count", 5)

        if not diagram:
            return Response({"error": "Falta el diagrama UML"}, status=status.HTTP_400_BAD_REQUEST)

        result = generate_test_data_with_gemini(diagram, count)
        return Response(result, status=status.HTTP_200_OK)


class FixtureGeneratorSQLView(APIView):
    """
    Genera datos de prueba en formato SQL (INSERT statements).
    """
    def post(self, request):
        diagram = request.data.get("diagram")
        count = request.data.get("count", 5)

        if not diagram:
            return Response({"error": "Falta el diagrama UML"}, status=status.HTTP_400_BAD_REQUEST)

        result = generate_test_data_with_gemini(diagram, count)

        if "error" in result:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        sql_statements = fixtures_to_sql(result)
        return Response({"sql": sql_statements}, status=status.HTTP_200_OK)
