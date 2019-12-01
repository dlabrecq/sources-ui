import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { useParams, Redirect } from 'react-router-dom';
import { useIntl } from 'react-intl';

import { addMessage, addHiddenSource } from '../../redux/actions/providers';
import { doLoadSource } from '../../api/entities';

const RedirectNoId = () => {
    const { id } = useParams();
    const intl = useIntl();

    const { loaded, appTypesLoaded, sourceTypesLoaded } = useSelector(({ providers }) => providers, shallowEqual);
    const dispatch = useDispatch();

    const [applicationIsLoaded, setIsApplicationLoaded] = useState(false);

    useEffect(() => {
        if (loaded && appTypesLoaded && sourceTypesLoaded) {
            doLoadSource(id).then(({ sources: [source] }) => dispatch(addHiddenSource(source)))
            .then(() => {
                setIsApplicationLoaded(true);
            });
        }
    }, [loaded, appTypesLoaded, sourceTypesLoaded]);

    if (applicationIsLoaded) {
        dispatch(addMessage(
            intl.formatMessage({
                id: 'sources.sourceNotFoundTitle',
                defaultMessage: 'Requested source was not found'
            }),
            'danger',
            intl.formatMessage({
                id: 'sources.sourceNotFoundTitleDescription',
                defaultMessage: 'Source with { id } was not found. Try it again later.'
            }, { id })
        ));
        return <Redirect to="/" />;
    }

    return null;
};

export default RedirectNoId;