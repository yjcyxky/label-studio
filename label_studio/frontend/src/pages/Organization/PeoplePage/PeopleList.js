import { formatDistance } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { Pagination, Spinner, Userpic } from "../../../components";
import { usePage, usePageSize } from "../../../components/Pagination/Pagination";
import { useAPI } from "../../../providers/ApiProvider";
import { Block, Elem } from "../../../utils/bem";
import { isDefined } from "../../../utils/helpers";
import { Button } from "../../../components";
import { confirm } from "../../../components/Modal/Modal";
import { ErrorWrapper } from "../../../components/Error/Error";
import { useUpdateEffect } from "../../../utils/hooks";
import './PeopleList.styl';
import { CopyableTooltip } from '../../../components/CopyableTooltip/CopyableTooltip';

export const PeopleList = ({ onSelect, selectedUser, defaultSelected, currentUser }) => {
  const api = useAPI();
  const [currentOrganization, setCurrentOrganization] = useState(currentUser?.active_organization);
  const [usersList, setUsersList] = useState();
  const [currentPage] = usePage('page', 1);
  const [currentPageSize] = usePageSize('page_size', 30);
  const [totalItems, setTotalItems] = useState(0);

  console.log({ currentPage, currentPageSize, currentUser });

  const fetchUsers = async (page, pageSize) => {
    if (currentUser?.is_superuser) {
      const response = await api.callApi('users', {
        params: {
          page,
          page_size: pageSize,
        },
      });

      console.log("Users: ", response);
      if (response) {
        const results = response.map((user) => ({
          user
        }));
        setUsersList(results);
        setTotalItems(response.length);
      }
    } else if (currentUser?.active_organization) {
      const organization_id = currentUser?.active_organization;
      api.callApi('memberships', {
        params: {
          pk: organization_id,
          // contributed_to_projects: 1,
          page,
          page_size: pageSize,
        },
      }).then((response) => {
        console.log("Memberships: ", response);
        if (response?.results) {
          setUsersList(response.results);
          setTotalItems(response.count);

          if (!response.results.find(({ user }) => user.id === currentUser?.id)) {
            throw new Error("User is not a member of this organization");
          }
        }
      }).catch((error) => {
        console.log("Error: ", error);
        ErrorWrapper({
          title: "Error Fetching Memberships",
          message: "There are no memberships for this organization, please contact your administrator for adding you to the organization.",
          errorId: "Error Fetching Memberships",
          onGoBack: () => {
            window.history.back();
          },
          onReload: () => {
            window.location.reload();
          },
        })
      });
    }
  };

  const removeUser = useCallback(async (user, organizationId) => {
    confirm({
      title: "Remove User from Organization",
      body: `Are you sure you want to remove ${user.email} from this organization?`,
      okText: "Remove",
      onOk: async () => {
        api.callApi('deleteMembership', {
          params: {
            pk: organizationId,
            user_id: user.id,
          }
        }).then((response) => {
          window.location.reload();
        }).catch((error) => {
          console.log("Error: ", error);
          ErrorWrapper({
            title: "Error Removing User",
            message: "There was an error removing the user from the organization.",
            errorId: "Error Removing User",
            onGoBack: () => {
              window.history.back();
            },
            onReload: () => {
              window.location.reload();
            },
          })
        })
      },
      cancelText: "Cancel",
      onCancel: () => { },
    }, []);
  }, []);

  const selectUser = useCallback((user) => {
    console.log("Select User: ", selectedUser, user);
    if (selectedUser?.id === user.id) {
      onSelect?.(null);
    }
  }, [selectedUser]);

  useEffect(() => {
    fetchUsers(currentPage, currentPageSize);
    setCurrentOrganization(currentUser?.active_organization);
  }, [currentUser?.id, currentPage, currentPageSize]);

  useEffect(() => {
    console.log("Set the selectedUser: ", defaultSelected, usersList);
    if (isDefined(defaultSelected) && usersList) {
      const selected = usersList.find(({ user }) => user.id === Number(defaultSelected));

      if (selected) selectUser(selected.user);
    }
  }, [usersList, defaultSelected]);

  return (
    <>
      <Block name="people-list">
        <Elem name="wrapper">

          {usersList ? (
            <Elem name="users">
              <Elem name="header">
                <Elem name="column" mix="avatar" />
                <Elem name="column" mix="email">Email</Elem>
                <Elem name="column" mix="name">Name</Elem>
                {/* A deletion button for deleting a user from an organization */}
                <Elem name="column" mix="actions">Actions</Elem>
                <Elem name="column" mix="last-activity">Last Activity</Elem>
              </Elem>
              <Elem name="body">
                {usersList.map(({ user }) => {
                  console.log("UserList: ", user, selectedUser, currentUser)
                  const active = user.id === selectedUser?.id;

                  return (
                    <Elem key={`user-${user.id}`} name="user" mod={{ active }} onClick={() => selectUser(user)}>
                      <Elem name="field" mix="avatar">
                        <CopyableTooltip title={'User ID: ' + user.id} textForCopy={user.id}>
                          <Userpic user={user} style={{ width: 28, height: 28 }} />
                        </CopyableTooltip>
                      </Elem>
                      <Elem name="field" mix="email">
                        {user.email}
                      </Elem>
                      <Elem name="field" mix="name">
                        {user.first_name} {user.last_name}
                      </Elem>
                      <Elem name="field" mix="actions">
                        <Button style={{ padding: '5px' }} onClick={() => removeUser(user, currentOrganization)} disabled={user?.id === currentUser?.id || !currentOrganization}>
                          Remove
                        </Button>
                      </Elem>
                      <Elem name="field" mix="last-activity">
                        {formatDistance(new Date(user.last_activity), new Date(), { addSuffix: true })}
                      </Elem>
                    </Elem>
                  );
                })}
              </Elem>
            </Elem>
          ) : (
            <Elem name="loading">
              <Spinner size={36} />
            </Elem>
          )}
        </Elem>
        <Pagination
          page={currentPage}
          urlParamName="page"
          totalItems={totalItems}
          pageSize={currentPageSize}
          pageSizeOptions={[30, 50, 100]}
          onPageLoad={fetchUsers}
          style={{ paddingTop: 16 }}
        />
      </Block>
    </>
  );
};
