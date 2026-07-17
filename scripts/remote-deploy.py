#!/usr/bin/env python3
"""Upload MediaVault to a remote host over SSH and run Docker deploy.

Usage:
  REMOTE_HOST=43.139.120.213 REMOTE_USER=root REMOTE_PASSWORD='***' \\
    python3 scripts/remote-deploy.py

Or with key:
  REMOTE_HOST=... REMOTE_USER=root REMOTE_KEY=~/.ssh/id_rsa \\
    python3 scripts/remote-deploy.py
"""
from __future__ import annotations

import os
import sys
import tarfile
import io
import time
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("REMOTE_HOST", "").strip()
USER = os.environ.get("REMOTE_USER", "root").strip()
PASSWORD = os.environ.get("REMOTE_PASSWORD")
KEY = os.environ.get("REMOTE_KEY")
PORT = int(os.environ.get("REMOTE_PORT", "22"))
APP_DIR = os.environ.get("REMOTE_APP_DIR", "/opt/mediavault")
APP_PORT = os.environ.get("APP_PORT", "3000")
PUBLIC_HOST = os.environ.get("PUBLIC_HOST", HOST)

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    "uploads",
    ".cursor",
}


def make_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in ROOT.rglob("*"):
            rel = path.relative_to(ROOT)
            if any(part in EXCLUDE_DIRS for part in rel.parts):
                continue
            if path.is_file():
                tar.add(path, arcname=str(rel))
    return buf.getvalue()


def run(client: paramiko.SSHClient, cmd: str, check: bool = True) -> str:
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    if check and code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return out


def main() -> None:
    if not HOST:
        print("Set REMOTE_HOST", file=sys.stderr)
        sys.exit(1)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": HOST,
        "port": PORT,
        "username": USER,
        "timeout": 30,
        "allow_agent": False,
        "look_for_keys": False,
    }
    if KEY:
        connect_kwargs["key_filename"] = os.path.expanduser(KEY)
        connect_kwargs["look_for_keys"] = True
    elif PASSWORD:
        connect_kwargs["password"] = PASSWORD
    else:
        print("Set REMOTE_PASSWORD or REMOTE_KEY", file=sys.stderr)
        sys.exit(1)

    print(f"Connecting to {USER}@{HOST}:{PORT} ...")
    client.connect(**connect_kwargs)
    print("Connected.")

    run(client, "command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh")
    run(client, "systemctl enable --now docker || true", check=False)
    run(client, f"mkdir -p {APP_DIR}")

    print("Packing project...")
    data = make_tarball()
    print(f"Upload {len(data)} bytes...")
    sftp = client.open_sftp()
    remote_tar = f"/tmp/mediavault-deploy.tgz"
    with sftp.file(remote_tar, "wb") as f:
        f.write(data)
    sftp.close()

    run(client, f"tar -xzf {remote_tar} -C {APP_DIR}")
    secret = os.urandom(32).hex()
    env = f"""NEXTAUTH_URL=http://{PUBLIC_HOST}:{APP_PORT}
NEXTAUTH_SECRET={secret}
APP_URL=http://{PUBLIC_HOST}:{APP_PORT}
MONGODB_URI=mongodb://mongo:27017/mediavault
UPLOAD_DIR=/app/uploads
APP_PORT={APP_PORT}
"""
    sftp = client.open_sftp()
    with sftp.file(f"{APP_DIR}/.env", "w") as f:
        f.write(env)
    sftp.close()

    run(client, f"cd {APP_DIR} && docker compose --env-file .env up -d --build")
    print("Waiting for health...")
    time.sleep(8)
    run(
        client,
        f"cd {APP_DIR} && docker compose exec -T -e MONGODB_URI=mongodb://mongo:27017/mediavault app npx tsx scripts/seed.ts",
        check=False,
    )
    run(client, f"curl -I http://127.0.0.1:{APP_PORT} || true", check=False)
    # open firewall loosely if tools exist
    run(client, f"ufw allow {APP_PORT}/tcp || firewall-cmd --add-port={APP_PORT}/tcp --permanent || true", check=False)

    print("")
    print(f"✅ Deployed: http://{PUBLIC_HOST}:{APP_PORT}")
    print("Admin: admin@mediavault.local / Admin123!")
    client.close()


if __name__ == "__main__":
    main()
