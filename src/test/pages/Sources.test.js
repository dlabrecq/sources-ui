import React from 'react';
import { PrimaryToolbar } from '@redhat-cloud-services/frontend-components/PrimaryToolbar';
import { act } from 'react-dom/test-utils';

import { Button, Tooltip, Tile, Alert, Pagination, AlertActionLink, Chip, Select } from '@patternfly/react-core';

import { MemoryRouter, Link } from 'react-router-dom';
import NotificationsPortal from '@redhat-cloud-services/frontend-components-notifications/NotificationPortal';

import SourcesPageOriginal from '../../pages/Sources';
import SourcesTable from '../../components/SourcesTable/SourcesTable';

import { sourcesDataGraphQl, SOURCE_ALL_APS_ID } from '../__mocks__/sourcesData';
import { sourceTypesData, OPENSHIFT_ID, AMAZON_ID } from '../__mocks__/sourceTypesData';
import { applicationTypesData, CATALOG_APP } from '../__mocks__/applicationTypesData';

import { componentWrapperIntl } from '../../utilities/testsHelpers';

import { defaultSourcesState } from '../../redux/sources/reducer';
import * as api from '../../api/entities';
import * as typesApi from '../../api/source_types';
import EmptyStateTable from '../../components/SourcesTable/EmptyStateTable';
import { routes, replaceRouteId } from '../../Routes';
import * as helpers from '../../pages/Sources/helpers';
import RedirectNoWriteAccess from '../../components/RedirectNoWriteAccess/RedirectNoWriteAccess';
import * as SourceRemoveModal from '../../components/SourceRemoveModal/SourceRemoveModal';
import * as urlQuery from '../../utilities/urlQuery';
import { PlaceHolderTable, PaginationLoader } from '../../components/SourcesTable/loaders';
import { Table } from '@patternfly/react-table';
import SourcesErrorState from '../../components/SourcesErrorState';
import DataLoader from '../../components/DataLoader';
import TabNavigation from '../../components/TabNavigation';
import CloudCards from '../../components/CloudTiles/CloudCards';
import { CLOUD_VENDOR, REDHAT_VENDOR } from '../../utilities/constants';
import CloudEmptyState from '../../components/CloudTiles/CloudEmptyState';
import { getStore } from '../../utilities/store';
import { AVAILABLE, UNAVAILABLE } from '../../views/formatters';
import RedHatEmptyState from '../../components/RedHatTiles/RedHatEmptyState';
import { AddSourceWizard } from '../../components/addSourceWizard';

jest.mock('react', () => {
  const React = jest.requireActual('react');
  const Suspense = ({ children }) => {
    return children;
  };

  const lazy = jest.fn().mockImplementation((fn) => {
    const Component = (props) => {
      const [C, setC] = React.useState();
      const mounted = React.useRef(true);

      React.useEffect(() => {
        fn().then((v) => {
          mounted.current && setC(v);
        });

        return () => {
          mounted.current = false;
        };
      }, []);

      return C ? <C.default {...props} /> : null;
    };

    return Component;
  });

  return {
    ...React,
    lazy,
    Suspense,
  };
});

describe('SourcesPage', () => {
  let initialProps;
  let store;
  let wrapper;
  const SourcesPage = (props) => (
    <React.Fragment>
      <DataLoader />
      <SourcesPageOriginal {...props} />
    </React.Fragment>
  );

  beforeEach(() => {
    initialProps = {};

    api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: sourcesDataGraphQl }));
    api.doLoadCountOfSources = jest
      .fn()
      .mockImplementation(() => Promise.resolve({ meta: { count: sourcesDataGraphQl.length } }));
    api.doLoadAppTypes = jest.fn().mockImplementation(() => Promise.resolve(applicationTypesData));
    typesApi.doLoadSourceTypes = jest.fn().mockImplementation(() => Promise.resolve(sourceTypesData.data));

    store = getStore([], {
      user: { isOrgAdmin: true },
    });

    urlQuery.updateQuery = jest.fn();
    urlQuery.parseQuery = jest.fn();
  });

  it('should fetch sources and source types on component mount', async () => {
    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    expect(api.doLoadEntities).toHaveBeenCalled();
    expect(api.doLoadAppTypes).toHaveBeenCalled();
    expect(typesApi.doLoadSourceTypes).toHaveBeenCalled();

    wrapper.update();

    expect(wrapper.find(TabNavigation)).toHaveLength(1);
    expect(wrapper.find(PrimaryToolbar)).toHaveLength(2);
    expect(wrapper.find(CloudCards)).toHaveLength(1);
    expect(wrapper.find(SourcesTable)).toHaveLength(1);
    expect(wrapper.find(Pagination)).toHaveLength(2);
    expect(wrapper.find(PaginationLoader)).toHaveLength(0);
    expect(wrapper.find(PrimaryToolbar).first().props().actionsConfig).toEqual({
      actions: expect.any(Array),
      dropdownProps: { position: 'right' },
    });
    expect(wrapper.find(PrimaryToolbar).last().props().actionsConfig).toEqual(undefined);
    expect(wrapper.find(RedirectNoWriteAccess)).toHaveLength(0);

    expect(urlQuery.parseQuery.mock.calls).toHaveLength(1);
    expect(urlQuery.updateQuery.mock.calls).toHaveLength(1);
    expect(urlQuery.updateQuery).toHaveBeenCalledWith(defaultSourcesState);
  });

  it('do not show CloudCards on Red Hat page', async () => {
    store = getStore([], {
      sources: { activeVendor: REDHAT_VENDOR },
      user: { isOrgAdmin: true },
    });

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    wrapper.update();

    expect(wrapper.find(CloudCards)).toHaveLength(0);
  });

  it('renders empty state when there are no Sources - CLOUD', async () => {
    store = getStore([], {
      sources: { activeVendor: CLOUD_VENDOR },
      user: { isOrgAdmin: true },
    });

    api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
    api.doLoadCountOfSources = jest.fn().mockImplementation(() => Promise.resolve({ meta: { count: 0 } }));

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    wrapper.update();

    expect(wrapper.find(CloudEmptyState)).toHaveLength(1);
    expect(wrapper.find(RedHatEmptyState)).toHaveLength(0);
    expect(wrapper.find(PrimaryToolbar)).toHaveLength(0);
    expect(wrapper.find(SourcesTable)).toHaveLength(0);
  });

  it('renders empty state when there are no Sources and open AWS selection', async () => {
    let tmpLocation;

    tmpLocation = Object.assign({}, window.location);
    delete window.location;
    window.location = {};
    window.location.pathname = routes.sources.path;
    window.location.search = `?activeVendor=${CLOUD_VENDOR}`;

    store = getStore([], {
      sources: { activeVendor: CLOUD_VENDOR },
      user: { isOrgAdmin: true },
    });

    api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
    api.doLoadCountOfSources = jest.fn().mockImplementation(() => Promise.resolve({ meta: { count: 0 } }));

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });
    wrapper.update();

    expect(wrapper.find(CloudEmptyState)).toHaveLength(1);

    await act(async () => {
      wrapper.find(Tile).first().simulate('click');
    });
    wrapper.update();

    expect(wrapper.find(MemoryRouter).instance().history.location.pathname).toEqual(routes.sourcesNew.path);
    expect(wrapper.find(AddSourceWizard).props().selectedType).toEqual('amazon');

    window.location = tmpLocation;
  });

  it('renders empty state when there are no Sources - RED HAT', async () => {
    store = getStore([], {
      sources: { activeVendor: REDHAT_VENDOR },
      user: { isOrgAdmin: true },
    });

    api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
    api.doLoadCountOfSources = jest.fn().mockImplementation(() => Promise.resolve({ meta: { count: 0 } }));

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    wrapper.update();
    expect(wrapper.find(RedHatEmptyState)).toHaveLength(1);
    expect(wrapper.find(CloudEmptyState)).toHaveLength(0);
    expect(wrapper.find(PrimaryToolbar)).toHaveLength(0);
    expect(wrapper.find(SourcesTable)).toHaveLength(0);
  });

  it('renders empty state when there are no Sources and open ansible-tower selection', async () => {
    store = getStore([], {
      sources: { activeVendor: REDHAT_VENDOR },
      user: { isOrgAdmin: true },
    });

    api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
    api.doLoadCountOfSources = jest.fn().mockImplementation(() => Promise.resolve({ meta: { count: 0 } }));

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });
    wrapper.update();

    expect(wrapper.find(RedHatEmptyState)).toHaveLength(1);

    await act(async () => {
      wrapper.find(Tile).first().simulate('click');
    });
    wrapper.update();

    expect(wrapper.find(MemoryRouter).instance().history.location.pathname).toEqual(routes.sourcesNew.path);
    expect(wrapper.find(AddSourceWizard).props().selectedType).toEqual('ansible-tower');
  });

  it('renders error state when there is fetching (loadEntities) error', async () => {
    const ERROR_MESSAGE = 'ERROR_MESSAGE';
    api.doLoadEntities = jest.fn().mockImplementation(() => Promise.reject({ detail: ERROR_MESSAGE }));

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    wrapper.update();
    expect(wrapper.find(SourcesErrorState)).toHaveLength(1);
    expect(wrapper.find(PrimaryToolbar)).toHaveLength(0);
    expect(wrapper.find(SourcesTable)).toHaveLength(0);
  });

  it('renders error state when there is loading (sourceTypes/appTypes) error', async () => {
    const ERROR_MESSAGE = 'ERROR_MESSAGE';
    api.doLoadAppTypes = jest.fn().mockImplementation(() => Promise.reject({ detail: ERROR_MESSAGE }));

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    wrapper.update();
    expect(wrapper.find(SourcesErrorState)).toHaveLength(1);
    expect(wrapper.find(PrimaryToolbar)).toHaveLength(0);
    expect(wrapper.find(SourcesTable)).toHaveLength(0);
  });

  it('renders table and filtering - loading', async () => {
    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    expect(wrapper.find(PrimaryToolbar)).toHaveLength(2);
    expect(wrapper.find(SourcesTable)).toHaveLength(1);
    expect(wrapper.find(PaginationLoader)).toHaveLength(2);
  });

  it('renders table and filtering - loading with paginationClicked: true, do not show paginationLoader', async () => {
    store = getStore([], {
      sources: { loaded: 1, paginationClicked: true, numberOfEntities: 5 },
      user: { isOrgAdmin: true },
    });

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    expect(wrapper.find(PrimaryToolbar)).toHaveLength(2);
    expect(wrapper.find(SourcesTable)).toHaveLength(1);
    expect(wrapper.find(PaginationLoader)).toHaveLength(0);
    expect(wrapper.find(Pagination)).toHaveLength(2);
  });

  describe('filter source type selection', () => {
    let tmpLocation;

    beforeEach(() => {
      tmpLocation = Object.assign({}, window.location);

      delete window.location;

      window.location = {};

      window.location.pathname = routes.sources.path;
    });

    afterEach(() => {
      window.location = tmpLocation;
    });

    it('shows only Red Hat sources in the selection (filters satellite out)', async () => {
      window.location.search = `?activeVendor=${REDHAT_VENDOR}`;

      store = getStore([], {
        sources: {
          loaded: 1,
          numberOfEntities: 5,
          sourceTypes: sourceTypesData.data,
          activeVendor: REDHAT_VENDOR,
        },
        user: { isOrgAdmin: true },
      });

      await act(async () => {
        wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
      });

      expect(
        wrapper
          .find(PrimaryToolbar)
          .first()
          .props()
          .filterConfig.items[1].filterValues.items.map(({ label }) => label)
      ).toEqual([
        'Ansible Tower',
        'OpenShift Container Platform',
        'Red Hat CloudForms',
        'Red Hat OpenStack',
        'Red Hat Virtualization',
      ]);
    });

    it('shows only Cloud sources in the selection', async () => {
      window.location.search = `?activeVendor=${CLOUD_VENDOR}`;

      store = getStore([], {
        sources: {
          loaded: 1,
          numberOfEntities: 5,
          sourceTypes: sourceTypesData.data,
          activeVendor: CLOUD_VENDOR,
        },
        user: { isOrgAdmin: true },
      });

      await act(async () => {
        wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
      });

      expect(
        wrapper
          .find(PrimaryToolbar)
          .first()
          .props()
          .filterConfig.items[1].filterValues.items.map(({ label }) => label)
      ).toEqual(['Amazon Web Services', 'Microsoft Azure', 'VMware vSphere']);
    });

    it('renders correctly with type/application, loads all data', async () => {
      window.location.search = '?type=amazon';

      store = getStore([], {
        sources: {
          loaded: 1,
          numberOfEntities: 5,
          sourceTypes: sourceTypesData.data,
          activeVendor: CLOUD_VENDOR,
        },
        user: { isOrgAdmin: true },
      });

      await act(async () => {
        wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
      });
      wrapper.update();

      expect(api.doLoadEntities).toHaveBeenCalled();
      expect(api.doLoadAppTypes).toHaveBeenCalled();
      expect(typesApi.doLoadSourceTypes).toHaveBeenCalled();
    });
  });

  it('renders addSourceWizard', async () => {
    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });
    wrapper.update();

    await act(async () => {
      wrapper.find(Link).first().simulate('click', { button: 0 });
    });
    wrapper.update();

    expect(wrapper.find(MemoryRouter).instance().history.location.pathname).toEqual(routes.sourcesNew.path);
    expect(wrapper.find(AddSourceWizard)).toHaveLength(1);
    expect(wrapper.find(AddSourceWizard).props().selectedType).toEqual();
  });

  it('renders and decreased page number if it is too great', async () => {
    store = getStore([], {
      sources: { pageNumber: 20 },
      user: { isOrgAdmin: true },
    });

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });
    wrapper.update();

    const paginationInput = wrapper.find('.pf-c-pagination__nav-page-select').first().find('input').first();

    expect(paginationInput.props().value).toEqual(1);
  });

  it('closes addSourceWizard', async () => {
    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });
    wrapper.update();

    await act(async () => {
      wrapper.find(Link).first().simulate('click', { button: 0 });
    });
    wrapper.update();

    expect(wrapper.find(RedirectNoWriteAccess)).toHaveLength(1);

    await act(async () => {
      wrapper.find(AddSourceWizard).props().onClose();
    });
    wrapper.update();

    expect(wrapper.find(MemoryRouter).instance().history.location.pathname).toEqual(routes.sources.path);
  });

  it('afterSuccess addSourceWizard', async () => {
    helpers.afterSuccess = jest.fn();

    const source = { id: '544615', name: 'name of created source' };

    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });
    wrapper.update();

    expect(urlQuery.parseQuery.mock.calls).toHaveLength(1);
    expect(urlQuery.updateQuery.mock.calls).toHaveLength(1);

    await act(async () => {
      wrapper.find(Link).first().simulate('click', { button: 0 });
    });
    wrapper.update();

    expect(urlQuery.parseQuery.mock.calls).toHaveLength(1);
    expect(urlQuery.updateQuery.mock.calls).toHaveLength(2);

    await act(async () => {
      wrapper.find(AddSourceWizard).props().afterSuccess(source);
    });
    wrapper.update();

    expect(helpers.afterSuccess).toHaveBeenCalledWith(expect.any(Function), source);
  });

  it('submitCallback addSourceWizard - available', async () => {
    const checkSubmitSpy = jest.spyOn(helpers, 'checkSubmit');

    const source = {
      isSubmitted: true,
      sourceTypes: sourceTypesData.data,
      createdSource: {
        id: '544615',
        source_type_id: AMAZON_ID,
        name: 'name of created source',
        applications: [{ availability_status: AVAILABLE }],
      },
    };

    await act(async () => {
      wrapper = mount(
        componentWrapperIntl(
          <React.Fragment>
            <NotificationsPortal />
            <SourcesPage {...initialProps} />
          </React.Fragment>,
          store
        )
      );
    });
    wrapper.update();

    await act(async () => {
      wrapper.find(Link).first().simulate('click', { button: 0 });
    });
    wrapper.update();

    await act(async () => {
      wrapper.find(AddSourceWizard).props().submitCallback(source);
    });
    wrapper.update();

    expect(checkSubmitSpy).toHaveBeenCalledWith(
      source,
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ formatMessage: expect.any(Function) }),
      expect.any(Function)
    );

    expect(wrapper.find(Alert).text()).toEqual(
      'Success alert:Amazon Web Services connection successfulSource name of created source was successfully addedView source details'
    );
    expect(wrapper.find(Alert).props().variant).toEqual('success');

    await act(async () => {
      wrapper.find(AlertActionLink).find('button').simulate('click');
    });
    wrapper.update();

    expect(wrapper.find(Alert)).toHaveLength(0);

    expect(wrapper.find(MemoryRouter).instance().history.location.pathname).toEqual(
      replaceRouteId(routes.sourcesDetail.path, '544615')
    );
  });

  it('submitCallback addSourceWizard - open wizard on error', async () => {
    const checkSubmitSpy = jest.spyOn(helpers, 'checkSubmit');

    const wizardState = {
      activeStep: 'name_step',
      activeStepIndex: '0',
      maxStepIndex: 3,
      prevSteps: [],
      registeredFieldsHistory: {},
    };

    const source = {
      isErrored: true,
      sourceTypes: sourceTypesData.data,
      values: { source: { name: 'some-name' } },
      wizardState,
    };

    await act(async () => {
      wrapper = mount(
        componentWrapperIntl(
          <React.Fragment>
            <NotificationsPortal />
            <SourcesPage {...initialProps} />
          </React.Fragment>,
          store
        )
      );
    });
    wrapper.update();

    await act(async () => {
      wrapper.find(Link).first().simulate('click', { button: 0 });
    });
    wrapper.update();

    await act(async () => {
      wrapper.find(AddSourceWizard).props().submitCallback(source);
    });
    wrapper.update();

    expect(checkSubmitSpy).toHaveBeenCalledWith(
      source,
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ formatMessage: expect.any(Function) }),
      expect.any(Function)
    );

    expect(wrapper.find(Alert).text()).toEqual(
      'Danger alert:Error adding sourceThere was a problem while trying to add source some-name. Please try again. If the error persists, open a support case.Retry'
    );

    await act(async () => {
      wrapper.find(AlertActionLink).find('button').simulate('click');
    });
    wrapper.update();

    expect(wrapper.find(Alert)).toHaveLength(0);

    expect(wrapper.find(MemoryRouter).instance().history.location.pathname).toEqual(routes.sourcesNew.path);
    expect(wrapper.find(AddSourceWizard).props().initialValues).toEqual({ source: { name: 'some-name' } });
    expect(wrapper.find(AddSourceWizard).props().initialWizardState).toEqual(wizardState);

    // reopen wizard to remove the initial values
    await act(async () => {
      wrapper.find(AddSourceWizard).props().onClose();
    });
    wrapper.update();

    await act(async () => {
      wrapper.find(Link).first().simulate('click', { button: 0 });
    });
    wrapper.update();

    expect(wrapper.find(AddSourceWizard).props().initialValues).toEqual({});
    expect(wrapper.find(AddSourceWizard).props().initialWizardState).toEqual(undefined);
  });

  it('renders loading state when is loading', async () => {
    await act(async () => {
      wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
    });

    expect(wrapper.find(PlaceHolderTable)).toHaveLength(1);
    expect(wrapper.find(Table)).toHaveLength(1);
    wrapper.update();
    expect(wrapper.find(PlaceHolderTable)).toHaveLength(0);
    expect(wrapper.find(Table)).toHaveLength(1);
  });

  describe('filtering', () => {
    const EMPTY_VALUE = '';
    const SEARCH_TERM = 'Pepa';
    const FILTER_INPUT_INDEX = 0;

    let wrapper;
    const filterInput = (wrapper) => wrapper.find('input').at(FILTER_INPUT_INDEX);

    beforeEach(async () => {
      await act(async () => {
        wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
      });
      wrapper.update();

      await act(async () => {
        filterInput(wrapper).simulate('change', {
          target: { value: SEARCH_TERM },
        });
      });
      wrapper.update();
    });

    it('should call onFilterSelect', (done) => {
      setTimeout(() => {
        expect(store.getState().sources.filterValue).toEqual({
          name: SEARCH_TERM,
        });
        done();
      }, 500);
    });

    it('should call onFilterSelect with type', (done) => {
      setTimeout(() => {
        wrapper.update();
        expect(wrapper.find(Chip)).toHaveLength(1);

        // Switch to source type in conditional filter
        wrapper.find('ConditionalFilter').setState({ stateValue: 1 });
        wrapper.update();

        const checkboxDropdownProps = wrapper.find(Select).last().props();

        // Select openshift
        const EVENT = {};
        checkboxDropdownProps.onSelect(EVENT, OPENSHIFT_ID);
        wrapper.update();

        expect(wrapper.find(Chip)).toHaveLength(2);
        expect(store.getState().sources.filterValue).toEqual({
          name: SEARCH_TERM,
          source_type_id: [OPENSHIFT_ID],
        });
        done();
      }, 500);
    });

    it('should call onFilterSelect with applications', (done) => {
      setTimeout(() => {
        wrapper.update();
        expect(wrapper.find(Chip)).toHaveLength(1);

        // Switch to source type in conditional filter
        wrapper.find('ConditionalFilter').setState({ stateValue: 2 });
        wrapper.update();

        const checkboxDropdownProps = wrapper.find(Select).last().props();

        // Select openshift
        const EVENT = {};
        checkboxDropdownProps.onSelect(EVENT, CATALOG_APP.id);
        wrapper.update();

        expect(wrapper.find(Chip)).toHaveLength(2);
        expect(store.getState().sources.filterValue).toEqual({
          name: SEARCH_TERM,
          applications: [CATALOG_APP.id],
        });
        done();
      }, 500);
    });

    it('should call onFilterSelect with available status', (done) => {
      setTimeout(() => {
        wrapper.update();
        expect(wrapper.find(Chip)).toHaveLength(1);

        // Switch to status type in conditional filter
        wrapper.find('ConditionalFilter').setState({ stateValue: 3 });
        wrapper.update();

        const checkboxDropdownProps = wrapper.find(Select).last().props();

        const EVENT = { target: { checked: true } };
        const EVENT_FALSE = { target: { checked: false } };

        // Select available
        checkboxDropdownProps.onSelect(EVENT, AVAILABLE);
        wrapper.update();

        expect(wrapper.find(Chip)).toHaveLength(2);
        expect(store.getState().sources.filterValue).toEqual({
          name: SEARCH_TERM,
          availability_status: [AVAILABLE],
        });

        // Select unavailable
        checkboxDropdownProps.onSelect(EVENT, UNAVAILABLE);
        wrapper.update();

        expect(store.getState().sources.filterValue).toEqual({
          name: SEARCH_TERM,
          availability_status: [UNAVAILABLE],
        });

        // Deselect unavailable
        checkboxDropdownProps.onSelect(EVENT_FALSE, UNAVAILABLE);
        wrapper.update();

        expect(store.getState().sources.filterValue).toEqual({
          name: SEARCH_TERM,
          availability_status: [],
        });

        done();
      }, 500);
    });

    it('filtered value is shown in the input', () => {
      expect(filterInput(wrapper).props().value).toEqual(SEARCH_TERM);
    });

    it('should remove the name badge when clicking on remove icon in chip', (done) => {
      setTimeout(async () => {
        wrapper.update();

        expect(wrapper.find(Chip)).toHaveLength(1);

        const chipButton = wrapper.find(Chip).find(Button);

        await act(async () => chipButton.simulate('click'));
        wrapper.update();

        expect(wrapper.find(Chip)).toHaveLength(0);
        expect(filterInput(wrapper).props().value).toEqual(EMPTY_VALUE);

        done();
      }, 500);
    });

    it('should not remove the name badge when clicking on chip', (done) => {
      setTimeout(async () => {
        wrapper.update();

        expect(wrapper.find(Chip)).toHaveLength(1);

        await act(async () => wrapper.find(Chip).simulate('click'));
        wrapper.update();

        expect(wrapper.find(Chip)).toHaveLength(1);
        expect(filterInput(wrapper).props().value).toEqual(SEARCH_TERM);

        done();
      }, 500);
    });

    it('should remove the name badge when clicking on Clear filters button', (done) => {
      const clearFillterButtonSelector = '.pf-m-link';

      setTimeout(async () => {
        wrapper.update();

        expect(wrapper.find(clearFillterButtonSelector)).toHaveLength(1);

        await act(async () => wrapper.find(clearFillterButtonSelector).simulate('click'));
        wrapper.update();

        expect(wrapper.find(clearFillterButtonSelector)).toHaveLength(0);
        done();
      }, 500);
    });

    it('renders emptyStateTable when no entities found', (done) => {
      setTimeout(async () => {
        wrapper.update();

        api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
        api.doLoadCountOfSources = jest.fn().mockImplementation(() => Promise.resolve({ meta: { count: 0 } }));

        const totalNonsense = '122#$@#%#^$#@!^$#^$#^546454abcerd';

        await act(async () => {
          filterInput(wrapper).simulate('change', {
            target: { value: totalNonsense },
          });
        });

        setTimeout(() => {
          wrapper.update();
          expect(store.getState().sources.filterValue).toEqual({
            name: totalNonsense,
          });
          expect(store.getState().sources.numberOfEntities).toEqual(0);
          expect(wrapper.find(EmptyStateTable)).toHaveLength(1);
          expect(wrapper.find(Pagination)).toHaveLength(0);
          done();
        }, 500);
      }, 500);
    });

    it('show empty state table after clicking on clears all filter in empty table state - RED HAT', async (done) => {
      store = getStore([], {
        sources: { activeVendor: REDHAT_VENDOR },
        user: { isOrgAdmin: true },
      });

      await act(async () => {
        wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
      });
      wrapper.update();

      await act(async () => {
        filterInput(wrapper).simulate('change', {
          target: { value: SEARCH_TERM },
        });
      });
      wrapper.update();

      setTimeout(async () => {
        wrapper.update();

        api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
        api.doLoadCountOfSources = jest.fn().mockImplementation(() => Promise.resolve({ meta: { count: 0 } }));

        const totalNonsense = '122#$@#%#^$#@!^$#^$#^546454abcerd';

        await act(async () => {
          filterInput(wrapper).simulate('change', {
            target: { value: totalNonsense },
          });
        });

        setTimeout(async () => {
          wrapper.update();

          expect(filterInput(wrapper).props().value).toEqual(totalNonsense);

          await act(async () => {
            wrapper.find(Button).last().simulate('click');
          });
          wrapper.update();

          expect(wrapper.find(RedHatEmptyState)).toHaveLength(1);
          done();
        }, 500);
      }, 500);
    });

    it('clears filter value in the name input when clicking on clears all filter in empty table state and show table', (done) => {
      setTimeout(async () => {
        wrapper.update();

        api.doLoadEntities = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
        api.doLoadCountOfSources = jest.fn().mockImplementation(() => Promise.resolve({ meta: { count: 0 } }));

        const totalNonsense = '122#$@#%#^$#@!^$#^$#^546454abcerd';

        await act(async () => {
          filterInput(wrapper).simulate('change', {
            target: { value: totalNonsense },
          });
        });

        setTimeout(async () => {
          wrapper.update();

          expect(filterInput(wrapper).props().value).toEqual(totalNonsense);

          api.doLoadEntities.mockImplementation(() => Promise.resolve({ sources: sourcesDataGraphQl }));
          api.doLoadCountOfSources.mockImplementation(() => Promise.resolve({ meta: { count: sourcesDataGraphQl.length } }));

          await act(async () => {
            wrapper.find(Button).last().simulate('click');
          });
          wrapper.update();

          expect(filterInput(wrapper).props().value).toEqual(EMPTY_VALUE);
          done();
        }, 500);
      }, 500);
    });
  });

  describe('not org admin', () => {
    beforeEach(async () => {
      store = getStore([], {
        sources: {},
        user: { isOrgAdmin: false },
      });

      await act(async () => {
        wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store));
      });
      wrapper.update();
    });

    it('should fetch sources and source types on component mount', async () => {
      expect(api.doLoadEntities).toHaveBeenCalled();
      expect(api.doLoadAppTypes).toHaveBeenCalled();
      expect(typesApi.doLoadSourceTypes).toHaveBeenCalled();

      expect(wrapper.find(PrimaryToolbar)).toHaveLength(2);
      expect(wrapper.find(SourcesTable)).toHaveLength(1);
      expect(wrapper.find(Pagination)).toHaveLength(2);
      expect(wrapper.find(PaginationLoader)).toHaveLength(0);
      expect(wrapper.find('#addSourceButton').first().props().isDisabled).toEqual(true);
      expect(wrapper.find(PrimaryToolbar).find(Tooltip)).toHaveLength(1);
      expect(wrapper.find(RedirectNoWriteAccess)).toHaveLength(0);
    });
  });

  describe('routes', () => {
    let initialEntry;

    const wasRedirectedToRoot = (wrapper) =>
      wrapper.find(MemoryRouter).instance().history.location.pathname === routes.sources.path;

    it('renders remove', async () => {
      SourceRemoveModal.default = () => <h1>remove modal mock</h1>;
      initialEntry = [replaceRouteId(routes.sourcesRemove.path, SOURCE_ALL_APS_ID)];

      await act(async () => {
        wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store, initialEntry));
      });
      wrapper.update();

      expect(wrapper.find(RedirectNoWriteAccess)).toHaveLength(1);
      expect(wrapper.find(SourceRemoveModal.default)).toHaveLength(1);
    });

    describe('id not found, redirect back to sources', () => {
      const NONSENSE_ID = '&88{}#558';

      beforeEach(() => {
        api.doLoadSource = jest.fn().mockImplementation(() => Promise.resolve({ sources: [] }));
      });

      it('when remove', async () => {
        SourceRemoveModal.default = () => <h1>remove modal mock</h1>;
        initialEntry = [replaceRouteId(routes.sourcesRemove.path, NONSENSE_ID)];

        await act(async () => {
          wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store, initialEntry));
        });
        wrapper.update();

        expect(wrapper.find(RedirectNoWriteAccess)).toHaveLength(0);
        expect(wrapper.find(SourceRemoveModal.default)).toHaveLength(0);
        expect(wasRedirectedToRoot(wrapper)).toEqual(true);
      });
    });

    describe('not org admin, redirect back to sources', () => {
      beforeEach(() => {
        store = getStore([], {
          user: { isOrgAdmin: false },
        });
      });

      it('when remove', async () => {
        SourceRemoveModal.default = () => <h1>remove modal mock</h1>;
        initialEntry = [replaceRouteId(routes.sourcesRemove.path, SOURCE_ALL_APS_ID)];

        await act(async () => {
          wrapper = mount(componentWrapperIntl(<SourcesPage {...initialProps} />, store, initialEntry));
        });
        wrapper.update();

        expect(wrapper.find(SourceRemoveModal.default)).toHaveLength(0);
        expect(wasRedirectedToRoot(wrapper)).toEqual(true);
      });
    });
  });
});
