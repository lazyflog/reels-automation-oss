# vmake.ai plugin (optional, disabled by default)

This plugin lets the `remove_watermark` pipeline step call vmake.ai's video clean-up API
(watermark / burned-in subtitle removal). **It is off by default and no vmake code is
distributed with this repository.**

> [!WARNING]
> Removing watermarks or other rights-management information from videos you do not own can
> be a civil or criminal offence (e.g. Korean Copyright Act Art. 104-3, 17 U.S.C. §1202).
> vmake itself asks users to remove watermarks only from videos they own or have permission
> to edit. Read [docs/LEGAL.md](../../../docs/LEGAL.md) before enabling this plugin.

## How the plugin is loaded

When `ENABLE_WATERMARK_REMOVAL=true` and `VMAKE_AK` / `VMAKE_SK` are set, the worker adds
`VMAKE_SDK_DIR` (default `backend/plugins/vmake`) to `sys.path` and imports:

```python
from sdk.core.client import SkillClient

client = SkillClient(ak=VMAKE_AK, sk=VMAKE_SK)
result = client.run_task("videoscreenclear", "/path/to/video.mp4")
result["output_urls"][0]  # URL of the processed video
```

If the package is missing, the step logs a warning and the pipeline continues with the original
video.

## Installing

vmake does not publish an official Python SDK on PyPI. Obtain a Python client that provides the
interface above **from vmake / Meitu or a source you trust and that grants you a licence to use
it**, and review its code before running it. Then:

```
backend/plugins/vmake/
├── README.md          (this file)
├── requirements.txt   extra Python dependencies installed at image build time
└── sdk/               ← put the SDK package here (git-ignored)
    └── __init__.py
```

Rebuild the images (`docker compose up -d --build api worker`). The Dockerfile installs
`requirements.txt` only when `sdk/__init__.py` exists.

vmake's official, MIT-licensed tooling is the Node CLI
[`vmake-labs-cli`](https://www.npmjs.com/package/vmake-labs-cli); an adapter for it is welcome
as a contribution. API keys: <https://vmake.ai/developers>. The vmake API is a paid service
governed by vmake's terms.
