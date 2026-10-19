# syntax=docker/dockerfile:1

# Build from the tagged source instead of an upstream package or image.
# The release workflow supplies PACKAGE_VERSION.
FROM python:3.12-slim AS build

WORKDIR /src

COPY pyproject.toml README.md LICENSE.md ./
COPY pterodactyl_exporter/ ./pterodactyl_exporter/

ARG PACKAGE_VERSION
RUN test -n "${PACKAGE_VERSION}" \
    && SETUPTOOLS_SCM_PRETEND_VERSION="${PACKAGE_VERSION}" \
       python -m pip wheel --no-deps --wheel-dir /wheels .

FROM python:3.12-slim

LABEL org.opencontainers.image.source="https://github.com/scalbox/pterodactyl_exporter" \
      org.opencontainers.image.description="Pterodactyl Client API Prometheus exporter"

COPY --from=build /wheels /wheels
RUN python -m pip install --no-cache-dir /wheels/*.whl \
    && rm -rf /wheels \
    && mkdir -p /opt/pterodactyl_exporter/config

EXPOSE 9531/tcp

CMD ["python", "-m", "pterodactyl_exporter.pterodactyl_exporter", "--config-file=/opt/pterodactyl_exporter/config/config.yml"]
