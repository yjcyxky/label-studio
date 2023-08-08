### Install a development environment

You can run the latest Label Studio version locally without installing the package with pip. 

```bash
# Install all package dependencies
pip install -e .
# Run database migrations
python label_studio/manage.py migrate
# Start the server in development mode at http://localhost:8080
python label_studio/manage.py runserver
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