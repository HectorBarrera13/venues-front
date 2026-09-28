# Docker Daemon Configuration Guide by Environment

To pull or push images to `gateway.tail9a6ddb.ts.net:5000` from your workstation, configure the Docker daemon insecure registry setting according to your operating system and engine flavor.

---

## 1. Identify Your Docker Engine
Run in bash, zsh, or PowerShell:
```bash
docker info --format "os={{.OperatingSystem}} name={{.Name}} security={{.SecurityOptions}}"
```

---

## 2. Configuration by Platform

### A. Windows: Docker Desktop
- Open Docker Desktop → **Settings** (gear icon) → **Docker Engine**.
- Add `"insecure-registries": ["gateway.tail9a6ddb.ts.net:5000"]` to the JSON configuration.
- Click **Apply & restart**.
- *File location*: `%USERPROFILE%\.docker\daemon.json`.

### B. Windows: WSL2 (Standalone Docker Engine without Docker Desktop)
- Open your WSL2 distribution terminal.
- Edit `/etc/docker/daemon.json`:
  ```bash
  sudo nano /etc/docker/daemon.json
  ```
  Add:
  ```json
  {
    "insecure-registries": ["gateway.tail9a6ddb.ts.net:5000"]
  }
  ```
- Restart the docker service:
  ```bash
  sudo service docker restart
  ```
- *WSL2 DNS Tip*: If WSL cannot resolve `gateway.tail9a6ddb.ts.net`, enable mirrored networking in `%USERPROFILE%\.wslconfig`:
  ```ini
  [wsl2]
  networkingMode=mirrored
  ```
  Then run `wsl --shutdown` from PowerShell and restart WSL.

### C. macOS: Docker Desktop
- Docker Desktop → **Settings** → **Docker Engine**.
- Add `"insecure-registries": ["gateway.tail9a6ddb.ts.net:5000"]` and restart.
- *File location*: `~/.docker/daemon.json`.

### D. macOS: Colima
- Stop Colima and edit config:
  ```bash
  colima stop
  colima start --edit
  ```
- Add under the `docker:` block:
  ```yaml
  docker:
    insecure-registries:
      - gateway.tail9a6ddb.ts.net:5000
  ```

### E. macOS: OrbStack
- Run:
  ```bash
  orb config docker
  ```
- Add the key and run:
  ```bash
  orb restart docker
  ```

### F. Linux: System Docker Engine
- Edit `/etc/docker/daemon.json`:
  ```bash
  sudo nano /etc/docker/daemon.json
  ```
- Add or merge:
  ```json
  {
    "insecure-registries": ["gateway.tail9a6ddb.ts.net:5000"]
  }
  ```
- Restart the system service:
  ```bash
  sudo systemctl restart docker
  ```
