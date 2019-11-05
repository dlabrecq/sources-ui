import React, { useEffect, useReducer } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { Table, TableHeader, TableBody, sortable } from '@patternfly/react-table';
import { injectIntl } from 'react-intl';

import { sortEntities } from '../../redux/actions/providers';
import { formatters } from './formatters';
import { PlaceHolderTable, RowWrapperLoader } from './loaders';
import { prepareEntities } from '../../Utilities/filteringSorting';
import { sourcesViewDefinition } from '../../views/sourcesViewDefinition';

const itemToCells = (item, columns, sourceTypes, appTypes) => columns.filter(column => column.title || column.hidden)
.map(col => ({
    title: col.formatter ? formatters(col.formatter)(item[col.value], item, { sourceTypes, appTypes }) : item[col.value] || ''
}));

const renderSources = (entities, columns, sourceTypes, appTypes) =>
    entities.reduce((acc, item) => ([
        ...acc,
        {
            ...item,
            isOpen: !!item.expanded,
            cells: itemToCells(item, columns, sourceTypes, appTypes),
            disableActions: !!item.isDeleting
        }
    ]), []);

const reducer = (state, payload) => ({ ...state, ...payload });

const initialState = (columns) => ({
    rows: [],
    sortBy: {},
    isLoaded: false,
    cells: columns.filter(column => column.title || column.hidden).map(column => ({
        title: column.title,
        value: column.value,
        ...(column.sortable && { transforms: [sortable] })
    }))
});

export const insertEditAction = (actions, intl, push) => actions.splice(1, 0, {
    title: intl.formatMessage({
        id: 'sources.edit',
        defaultMessage: 'Edit'
    }),
    onClick: (_ev, _i, { id }) => push(`/edit/${id}`)
});

export const actionResolver = (intl, push) => (rowData) => {
    const actions = [{
        title: intl.formatMessage({
            id: 'sources.manageApps',
            defaultMessage: 'Manage applications'
        }),
        onClick: (_ev, _i, { id }) => push(`/manage_apps/${id}`)
    },
    {
        style: { color: 'var(--pf-global--danger-color--100)' },
        title: intl.formatMessage({
            id: 'sources.delete',
            defaultMessage: 'Delete'
        }),
        onClick: (_ev, _i, { id }) => push(`/remove/${id}`)
    }];

    const isSourceEditable = !rowData.imported;

    if (isSourceEditable) {
        insertEditAction(actions, intl, push);
    }

    return actions;
};

const SourcesSimpleView = ({
    entities,
    loaded,
    sourceTypesLoaded,
    appTypesLoaded,
    history: { push },
    intl,
    pageSize,
    pageNumber,
    sourceTypes,
    appTypes,
    sortEntities,
    sortBy,
    sortDirection,
    filterColumn,
    filterValue
}) => {
    const columns = sourcesViewDefinition.columns(intl);
    const [state, dispatch] = useReducer(reducer, initialState(columns));

    const refreshSources = (additionalOptions) => dispatch({
        rows: prepareEntities(
            renderSources(entities, columns, sourceTypes, appTypes),
            {
                sortBy,
                sortDirection,
                filterColumn,
                filterValue,
                pageNumber,
                pageSize,
                sourceTypes
            }
        ),
        ...additionalOptions
    });

    useEffect(() => {
        if (loaded && sourceTypesLoaded && appTypesLoaded) {
            dispatch({ isLoaded: true });
        } else {
            dispatch({ isLoaded: false });
        }
    }, [loaded, sourceTypesLoaded, appTypesLoaded]);

    useEffect(() => {
        refreshSources({
            sortBy: {
                index: state.cells.map(cell => cell.value).indexOf(sortBy), direction: sortDirection
            }
        });
    }, [sortDirection, sortBy]);

    useEffect(() => {
        refreshSources();
    }, [filterValue, filterColumn]);

    useEffect(() => {
        if (state.isLoaded) {
            refreshSources();
        }
    }, [entities, pageSize, pageNumber, state.isLoaded]);

    if (!state.isLoaded) {
        return <PlaceHolderTable />;
    }

    return (
        <Table
            gridBreakPoint='grid-lg'
            aria-label={intl.formatMessage({
                id: 'sources.list',
                defaultMessage: 'List of Sources'
            })}
            onSort={(_event, key, direction) => sortEntities(state.cells[key].value, direction)}
            sortBy={state.sortBy}
            rows={state.rows}
            cells={state.cells}
            actionResolver={actionResolver(intl, push)}
            rowWrapper={RowWrapperLoader}
        >
            <TableHeader />
            <TableBody />
        </Table>
    );
};

SourcesSimpleView.propTypes = {
    sortEntities: PropTypes.func.isRequired,
    entities: PropTypes.arrayOf(PropTypes.any),
    numberOfEntities: PropTypes.number.isRequired,
    loaded: PropTypes.bool.isRequired,
    sourceTypes: PropTypes.arrayOf(PropTypes.any),
    sourceTypesLoaded: PropTypes.bool,
    appTypesLoaded: PropTypes.bool,
    appTypes: PropTypes.arrayOf(PropTypes.any),
    pageSize: PropTypes.number.isRequired,
    pageNumber: PropTypes.number.isRequired,
    filterColumn: PropTypes.string,
    filterValue: PropTypes.string,
    sortBy: PropTypes.string,
    sortDirection: PropTypes.string,
    history: PropTypes.any.isRequired,
    intl: PropTypes.object.isRequired
};

SourcesSimpleView.defaultProps = {
    entities: [],
    numberOfEntities: 0,
    loaded: false,
    sourceTypesLoaded: false,
    appTypesLoaded: false,
    sourceTypes: [],
    appTypes: []
};

const mapDispatchToProps = dispatch => bindActionCreators({ sortEntities }, dispatch);

const mapStateToProps = ({ providers: { ...props } }) => (props);

export default injectIntl(connect(mapStateToProps, mapDispatchToProps)(withRouter(SourcesSimpleView)));
