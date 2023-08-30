# For developers

## Build a development environment
### Install a development environment

You can run the latest Label Studio version locally without installing the package with pip. 

```bash
# Install all package dependencies
pip install -e .
# Run database migrations
python label_studio/manage.py migrate
# Start the server in development mode at http://localhost:8080
python label_studio/manage.py runserver

# Clean up the database (macosx)
rm /Users/<username>/Library/Application\ Support/label-studio/label_studio.sqlite3
```

### Apply frontend changes

The frontend part of Label Studio app lies in the `frontend/` folder and written in React JSX. In case you've made some changes there, the following commands should be run before building / starting the instance:

```
source .env/bin/activate
cd label_studio/frontend/
npm ci
npx webpack
cd ../..
python label_studio/manage.py collectstatic --no-input
```

After that you can refresh the page and see the changes.

### Build a production-ready Docker image

```bash
docker build -t nordata/label-studio:v1.7.3-tgmc .
```

## Build a production
### Change the default settings

If you want to use the label studio with new user's settings, you must change the following settings:

1. `JWT_SECRET_KEY`: a secret key for signing the JWT token. You can change it with setting `JWT_SECRET_KEY` environment variable.

2. `MINIO_STORAGE_ENDPOINT`: a host name of the Minio server. You can change it with setting `MINIO_STORAGE_ENDPOINT` environment variable. Also you must change the `MINIO_STORAGE_BUCKET_NAME`, `MINIO_STORAGE_ACCESS_KEY` and `MINIO_STORAGE_SECRET_KEY` environment variables. If you didn't set the `MINIO_STORAGE_ENDPOINT` environment variable, the `Publication Manager` button will be disabled.

3. `KNOWLEDGE_GRAPH_SERVER`: a host name of the Knowledge Graph server. You can change it with setting `KNOWLEDGE_GRAPH_SERVER` environment variable.

## How it works?

### How to integrate KGE into Label Studio?

More details about the integration of KGE into Label Studio can be found in the following files:

1. `label_studio/templates/base.html`
2. `label_studio/core/settings/base.py`
3. `label_studio/core/urls.py`
4. `label_studio/core/utils/common.py`

### How to sync all users in Label Studio with the Minio server?

We have a syncer that syncs all users in Label Studio with the Minio server. The syncer is located in the `https://github.com/yjcyxky/paper-downloader/tree/main/paper_downloader/syncer.py` file. The syncer is run every 5 minutes. You can change the syncer's period in the `https://github.com/yjcyxky/prophet-studio/blob/main/.env` file.
