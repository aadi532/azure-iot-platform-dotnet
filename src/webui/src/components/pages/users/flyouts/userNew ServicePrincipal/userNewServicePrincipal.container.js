// Copyright (c) Microsoft. All rights reserved.

import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { UserNewServicePrincipal } from "./userNewServicePrincipal";
import {
    epics as usersEpics,
    redux as usersRedux,
} from "./node_modules/store/reducers/usersReducer";
import { epics as appEpics } from "./node_modules/store/reducers/appReducer";

// Pass the global info needed
const mapStateToProps = (state) => ({}),
    // Wrap the dispatch method
    mapDispatchToProps = (dispatch) => ({
        insertUsers: (users) => dispatch(usersRedux.actions.insertUsers(users)),
        fetchUsers: () => dispatch(usersEpics.actions.fetchUsers()),
        logEvent: (diagnosticsModel) =>
            dispatch(appEpics.actions.logEvent(diagnosticsModel)),
    });

export const UserNewServicePrincipalContainer = withTranslation()(
    connect(mapStateToProps, mapDispatchToProps)(UserNewServicePrincipal)
);
