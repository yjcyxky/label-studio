import React, { useState } from 'react';
import { useParams as useRouterParams } from 'react-router';
import { Redirect } from 'react-router-dom';
import { Button } from '../../components';
import { Oneof } from '../../components/Oneof/Oneof';
import { Spinner } from '../../components/Spinner/Spinner';
import { ApiContext } from '../../providers/ApiProvider';
import { useCurrentUser } from '../../providers/CurrentUser';
import { useContextProps } from '../../providers/RoutesProvider';
import { useAbortController } from "../../hooks/useAbortController";
import { Block, Elem } from '../../utils/bem';
import { FF_DEV_2575, isFF } from '../../utils/feature-flags';
import { CreateProject } from '../CreateProject/CreateProject';
import { DataManagerPage } from '../DataManager/DataManager';
import { SettingsPage } from '../Settings';
import './Projects.styl';
import { EmptyProjectsList, ProjectsList } from './ProjectsList';
import { confirm } from "../../components/Modal/Modal";

const getCurrentPage = () => {
  const pageNumberFromURL = new URLSearchParams(location.search).get("page");

  return pageNumberFromURL ? parseInt(pageNumberFromURL) : 1;
};

export const ProjectsPage = () => {
  const api = React.useContext(ApiContext);
  const abortController = useAbortController();
  const [organizationsList, setOrganizationsList] = React.useState([]);
  const [isCreatorOrSuperuser, setIsCreatorOrSuperuser] = React.useState(false);
  const [projectsList, setProjectsList] = React.useState([]);
  const [networkState, setNetworkState] = React.useState(null);
  const [currentPage, setCurrentPage] = useState(getCurrentPage());
  const [totalItems, setTotalItems] = useState(1);
  const setContextProps = useContextProps();
  const defaultPageSize = parseInt(localStorage.getItem('pages:projects-list') ?? 30);

  const [modal, setModal] = React.useState(false);
  const openModal = setModal.bind(null, true);
  const closeModal = setModal.bind(null, false);
  const { user } = useCurrentUser();

  console.log('ProjectsPage', user);

  // Get all organizations and pick up the created user's organization
  const fecthOrganizations = async (page = currentPage, pageSize = defaultPageSize) => {
    setNetworkState('loading');
    abortController.renew(); // Cancel any in flight requests

    const requestParams = { page, page_size: pageSize };
    const data = await api.callApi("organizations", {
      params: requestParams,
    });

    setNetworkState('loaded');
    setOrganizationsList(data ?? []);
  };

  const fetchProjects = async (page = currentPage, pageSize = defaultPageSize) => {
    setNetworkState('loading');
    abortController.renew(); // Cancel any in flight requests

    const requestParams = { page, page_size: pageSize };

    if (isFF(FF_DEV_2575)) {
      requestParams.include = [
        'id',
        'title',
        'created_by',
        'created_at',
        'color',
        'is_published',
        'assignment_settings',
      ].join(',');
    }

    const data = await api.callApi("projects", {
      params: requestParams,
      ...(isFF(FF_DEV_2575) ? {
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes('aborted'),
      } : null),
    });

    setTotalItems(data?.count ?? 1);
    setProjectsList(data.results ?? []);
    setNetworkState('loaded');

    if (isFF(FF_DEV_2575) && data?.results?.length) {
      const additionalData = await api.callApi("projects", {
        params: { ids: data?.results?.map(({ id }) => id).join(','), page_size: pageSize },
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes('aborted'),
      });

      if (additionalData?.results?.length) {
        setProjectsList(additionalData.results);
      }
    }
  };

  const loadNextPage = async (page, pageSize) => {
    setCurrentPage(page);
    await fetchProjects(page, pageSize);
  };

  React.useEffect(() => {
    fecthOrganizations();
    fetchProjects();
  }, []);

  React.useEffect(() => {
    console.log('organizationsList', organizationsList, user);
    if (organizationsList && user) {
      const filteredItem = organizationsList.find((item) => item.created_by === user.id);

      console.log('filteredItem', filteredItem);

      if (filteredItem) {
        setIsCreatorOrSuperuser(true);
      } else {
        if (user && user.is_superuser) {
          setIsCreatorOrSuperuser(true);
        } else {
          setIsCreatorOrSuperuser(false);
        }
      }
    }
  }, [organizationsList, user]);

  React.useEffect(() => {
    // there is a nice page with Create button when list is empty
    // so don't show the context button in that case
    console.log("PUBLICATION_MANAGER_SERVER: ", window.PUBLICATION_MANAGER_SERVER);
    console.log("KNOWLEDGE_GRAPH_SERVER: ", window.KNOWLEDGE_GRAPH_SERVER);
    console.log("HELP_DOC_SERVER: ", window.HELP_DOC_SERVER);
    setContextProps({
      openModal,
      showButton: projectsList.length > 0 && isCreatorOrSuperuser,
      user,
      publication_manager_server: window.PUBLICATION_MANAGER_SERVER,
      knowledge_graph_server: window.KNOWLEDGE_GRAPH_SERVER,
      help_doc_server: window.HELP_DOC_SERVER,
    });
  }, [projectsList.length, isCreatorOrSuperuser, user]);

  return (
    <Block name="projects-page">
      <Oneof value={networkState}>
        <Elem name="loading" case="loading">
          <Spinner size={64} />
        </Elem>
        <Elem name="content" case="loaded">
          {projectsList.length ? (
            <ProjectsList
              projects={projectsList}
              currentPage={currentPage}
              totalItems={totalItems}
              loadNextPage={loadNextPage}
              pageSize={defaultPageSize}
              showSettings={isCreatorOrSuperuser}
            />
          ) : (
            <EmptyProjectsList openModal={openModal} showButton={isCreatorOrSuperuser} />
          )}
          {(modal && isCreatorOrSuperuser) && <CreateProject onClose={closeModal} />}
        </Elem>
      </Oneof>
    </Block>
  );
};

ProjectsPage.title = "Projects";
ProjectsPage.path = "/projects";
ProjectsPage.exact = true;
ProjectsPage.routes = ({ store }) => [
  {
    title: () => store.project?.title,
    path: "/:id(\\d+)",
    exact: true,
    component: () => {
      const params = useRouterParams();

      return <Redirect to={`/projects/${params.id}/data`} />;
    },
    pages: {
      DataManagerPage,
      SettingsPage,
    },
  },
];
ProjectsPage.context = ({
  openModal, showButton, user, publication_manager_server,
  knowledge_graph_server, help_doc_server
}) => {
  const openPublicationManager = (user) => {
    confirm({
      width: 500,
      title: "Open Publication Manager",
      body: <div>
        Please refer your credentials for the Publication Manager:
        <br />
        <pre>
          Website: {publication_manager_server}
          <br />
          Account: {user.email}
          <br />
          Password: {user.minio_token}
        </pre>
        <br />
        Do you want to continue?
      </div>,
      okText: "Comfirm",
      onOk: () => {
        window.open(publication_manager_server, '_blank');
      },
      cancelText: "Cancel",
      onCancel: () => { },
    }, []);
  };

  return <div style={{ display: 'flex' }}>
    {showButton && <Button onClick={openModal} look="primary" size="compact">Create</Button>}
    <Button style={{ marginLeft: '5px', display: !knowledge_graph_server ? 'none' : 'block' }}
      onClick={() => window.open(knowledge_graph_server, '_blank')}
      size="compact">
      KG Studio
    </Button>
    <Button style={{ marginLeft: '5px', display: !publication_manager_server ? 'none' : 'block' }}
      onClick={() => openPublicationManager(user)} size="compact">
      Publication Manager
    </Button>
    {/* Help Button */}
    <Button style={{ marginLeft: '5px', display: !help_doc_server ? 'none' : 'block' }}
      onClick={() => window.open(help_doc_server, '_blank')}
      size="compact">
      Help
    </Button>
  </div>;
};
