from django.urls import path
from .views import FixtureGeneratorJSONView, FixtureGeneratorSQLView

urlpatterns = [
    path("generate/", FixtureGeneratorJSONView.as_view(), name="fixture-generate-json"),
    path("generate-sql/", FixtureGeneratorSQLView.as_view(), name="fixture-generate-sql"),
]
