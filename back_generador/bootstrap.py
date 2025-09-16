# back_generador/bootstrap.py
import os, socket, time, subprocess, sys, urllib.parse

def wait_tcp(host: str, port: int, name: str, timeout=1.5):
    print(f"⏳ Esperando {name} {host}:{port}...")
    while True:
        s = socket.socket()
        s.settimeout(timeout)
        try:
            s.connect((host, port))
            s.close()
            print(f"✅ {name} listo")
            return
        except Exception:
            s.close()
            time.sleep(1)

def maybe_wait_redis():
    url = os.getenv("REDIS_URL")
    if not url:
        return
    u = urllib.parse.urlparse(url)
    wait_tcp(u.hostname or "redis", int(u.port or 6379), "Redis")

def main():
    host = os.getenv("DB_HOST", "db")
    port = int(os.getenv("DB_PORT", "5432"))
    wait_tcp(host, port, "Postgres")
    maybe_wait_redis()

    print("🚀 Migrando base de datos…")
    subprocess.check_call([sys.executable, "manage.py", "migrate", "--noinput"])

    asgi_app = os.getenv("ASGI_APP", "diagramador.asgi:application")
    print(f"🏁 Iniciando Daphne -> {asgi_app}")
    os.execvp("daphne", ["daphne", "-b", "0.0.0.0", "-p", "8000", asgi_app])

if __name__ == "__main__":
    main()
