// Copyright (c) Microsoft. All rights reserved.

import { connect } from "react-redux";
import { ErrorLogDetails } from "./errorLogDetails";
import { epics as appEpics } from "store/reducers/appReducer";

// Wrap the dispatch method
const mapDispatchToProps = (dispatch) => ({
    logEvent: (diagnosticsModel) =>
        dispatch(appEpics.actions.logEvent(diagnosticsModel)),
});

export const ErrorLogDetailsContainer = connect(
    null,
    mapDispatchToProps
)(ErrorLogDetails);
