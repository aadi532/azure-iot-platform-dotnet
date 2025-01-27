// Copyright (c) Microsoft. All rights reserved.

// <flyout>
import React, { Component } from "react";

import { ExampleService } from "walkthrough/services";
import { svgs } from "utilities";
import {
    AjaxError,
    Btn,
    BtnToolbar,
    Flyout,
    Indicator,
    SectionDesc,
    SectionHeader,
    SummaryBody,
    SummaryCount,
    SummarySection,
    Svg,
} from "components/shared";

const classnames = require("classnames/bind");
const css = classnames.bind(require("./exampleFlyout.module.scss"));

export class ExampleFlyout extends Component {
    constructor(props) {
        super(props);
        this.state = {
            itemCount: 3, //just a fake count; this would often be a list of items that are being acted on
            isPending: false,
            error: undefined,
            successCount: 0,
            changesApplied: false,
            expandedValue: false,
        };
        this.expandFlyout = this.expandFlyout.bind(this);
    }

    componentWillUnmount() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    apply = (event) => {
        event.preventDefault();
        this.setState({ isPending: true, successCount: 0, error: null });

        this.subscription = ExampleService.updateExampleItems().subscribe(
            (_) => {
                this.setState({
                    successCount:
                        this.state.successCount + this.state.itemCount,
                });
                // Update any global state in the redux store by calling any
                // dispatch methods that were mapped in this flyout's container.
            },
            (error) =>
                this.setState({
                    error,
                    isPending: false,
                    changesApplied: true,
                }),
            () =>
                this.setState({
                    isPending: false,
                    changesApplied: true,
                    confirmStatus: false,
                })
        );
    };

    getSummaryMessage() {
        const { t } = this.props,
            { isPending, changesApplied } = this.state;

        if (isPending) {
            return t("walkthrough.pageWithFlyout.flyouts.example.pending");
        } else if (changesApplied) {
            return t("walkthrough.pageWithFlyout.flyouts.example.applySuccess");
        }
        return t("walkthrough.pageWithFlyout.flyouts.example.affected");
    }

    expandFlyout() {
        if (this.state.expandedValue) {
            this.setState({
                expandedValue: false,
            });
        } else {
            this.setState({
                expandedValue: true,
            });
        }
    }

    render() {
        const { t, onClose } = this.props,
            { itemCount, isPending, error, successCount, changesApplied } =
                this.state,
            summaryCount = changesApplied ? successCount : itemCount,
            completedSuccessfully = changesApplied && !error,
            summaryMessage = this.getSummaryMessage();

        return (
            <Flyout
                header={t("walkthrough.pageWithFlyout.flyouts.example.header")}
                t={t}
                onClose={onClose}
                expanded={this.state.expandedValue}
                onExpand={() => {
                    this.expandFlyout();
                }}
            >
                {/**
                 * Really, anything you need could go inside a flyout.
                 * The following is a simple empty form with buttons to do an action or close the flyout.
                 * */}
                <form
                    className={css("example-flyout-container")}
                    onSubmit={this.apply}
                >
                    <div className={css("example-flyout-header")}>
                        {t("walkthrough.pageWithFlyout.flyouts.example.header")}
                    </div>
                    <div className={css("example-flyout-descr")}>
                        {t(
                            "walkthrough.pageWithFlyout.flyouts.example.description"
                        )}
                    </div>

                    <div className={css("form-placeholder")}>
                        {t(
                            "walkthrough.pageWithFlyout.flyouts.example.insertFormHere"
                        )}
                    </div>

                    {/** Sumarizes the action being taken; including count of items affected & status/pending indicator */}
                    <SummarySection>
                        <SectionHeader>
                            {t(
                                "walkthrough.pageWithFlyout.flyouts.example.summaryHeader"
                            )}
                        </SectionHeader>
                        <SummaryBody>
                            <SummaryCount>{summaryCount}</SummaryCount>
                            <SectionDesc>{summaryMessage}</SectionDesc>
                            {this.state.isPending && <Indicator />}
                            {completedSuccessfully && (
                                <Svg
                                    className={css("summary-icon")}
                                    src={svgs.apply}
                                />
                            )}
                        </SummaryBody>
                    </SummarySection>

                    {/** Displays an error message if one occurs while applying changes. */}
                    {error && (
                        <AjaxError
                            className={css("example-flyout-error")}
                            t={t}
                            error={error}
                        />
                    )}
                    {
                        /** If changes are not yet applied, show the buttons for applying changes and closing the flyout. */
                        !changesApplied && (
                            <BtnToolbar>
                                <Btn
                                    svg={svgs.reconfigure}
                                    primary={true}
                                    disabled={isPending || itemCount === 0}
                                    type="submit"
                                >
                                    {t(
                                        "walkthrough.pageWithFlyout.flyouts.example.apply"
                                    )}
                                </Btn>
                                <Btn svg={svgs.cancelX} onClick={onClose}>
                                    {t(
                                        "walkthrough.pageWithFlyout.flyouts.example.cancel"
                                    )}
                                </Btn>
                            </BtnToolbar>
                        )
                    }
                    {
                        /**
                         * If changes are applied, show only the close button.
                         * Other text or component might be included here as well.
                         * For example, you might provide a link to the detail page for a newly submitted job.
                         * */
                        !!changesApplied && (
                            <BtnToolbar>
                                <Btn svg={svgs.cancelX} onClick={onClose}>
                                    {t(
                                        "walkthrough.pageWithFlyout.flyouts.example.close"
                                    )}
                                </Btn>
                            </BtnToolbar>
                        )
                    }
                </form>
            </Flyout>
        );
    }
}
// </flyout>
