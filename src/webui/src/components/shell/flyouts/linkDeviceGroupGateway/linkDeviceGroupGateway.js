// Copyright (c) Microsoft. All rights reserved.

import React from "react";
import { permissions, toDeviceDiagnosticsModel } from "services/models";
import { LinkedComponent, svgs } from "utilities";
import {
    AjaxError,
    Btn,
    BtnToolbar,
    Flyout,
    FormControl,
    FormGroup,
    FormLabel,
    Protected,
} from "components/shared";
import { IoTHubManagerService } from "services";
import { Link } from "react-router-dom";

export class LinkDeviceGroupGateway extends LinkedComponent {
    constructor(props) {
        super(props);

        this.state = {
            isPending: false,
            error: undefined,
            successCount: 0,
            changesApplied: false,
            message: undefined,
            formData: {
                selectedEdgeDeviceId: "",
            },
        };

        // Linked components
        this.formDataLink = this.linkTo("formData");

        this.edgeDeviceLink = this.formDataLink
            .forkTo("selectedEdgeDeviceId")
            .map(({ value }) => value);
        this.expandFlyout = this.expandFlyout.bind(this);
    }

    formIsValid() {
        return [this.edgeDeviceLink].every((link) => !link.error);
    }

    formControlChange = () => {
        if (this.state.changesApplied) {
            this.setState({
                successCount: 0,
                changesApplied: false,
            });
        }
    };

    onFlyoutClose = (eventName) => {
        this.props.logEvent(
            toDeviceDiagnosticsModel(eventName, this.state.formData)
        );
        this.props.closeFlyout();
    };

    onEdgeDeviceSelected = ({ target: { value } }) => {
        this.setState({
            selectedEdgeDeviceId: value,
        });
    };

    componentDidMount() {
        this.fetchEdgeDevices();
    }

    fetchEdgeDevices = () => {
        IoTHubManagerService.getDevicesByQuery(
            "capabilities.iotEdge=true"
        ).subscribe((edgeDevices) => {
            this.setState({
                edgeDeviceOptions: edgeDevices
                    ? edgeDevices.items.map((device) => ({
                          label: device.id,
                          value: device.id,
                      }))
                    : [],
            });
        });
    };

    apply = (event) => {
        event.preventDefault();
        const { formData } = this.state;
        if (this.formIsValid()) {
            this.setState({ isPending: true, error: null });
            if (
                this.props.activeDeviceGroupId != null &&
                this.props.activeDeviceGroupId !== ""
            ) {
                IoTHubManagerService.linkSelectedDeviceGroupToEdge(
                    this.props.activeDeviceGroupId,
                    formData.selectedEdgeDeviceId
                ).subscribe(
                    function (response) {
                        this.setState({
                            message: response.jobId,
                        });
                        this.props.fetchDevices();
                    }.bind(this),
                    (error) =>
                        this.setState({
                            error,
                            isPending: false,
                            changesApplied: false,
                        }), // On Error
                    () =>
                        this.setState({
                            isPending: false,
                            changesApplied: true,
                        }) // On Completed
                );
            } else {
                this.setState({
                    error: "Selected devices count should not be greater than 200",
                    isPending: false,
                    changesApplied: true,
                });
            }
            this.props.logEvent(
                toDeviceDiagnosticsModel("Devices_Linking_Click", formData)
            );
        }
    };

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
        const { t } = this.props,
            { isPending, error, changesApplied } = this.state;

        return (
            <Flyout
                header={t("linkDeviceGroupGateway.title")}
                t={t}
                onClose={() => this.onFlyoutClose("Devices_TopXCloseClick")}
                expanded={this.state.expandedValue}
                onExpand={() => {
                    this.expandFlyout();
                }}
            >
                <Protected permission={permissions.createDevices}>
                    <form
                        className="devices-new-container"
                        onSubmit={this.apply}
                    >
                        <div>{t("linkDeviceGroupGateway.description")}</div>
                        <div>
                            <FormGroup>
                                <FormLabel isRequired="true">
                                    {t("linkDeviceGroupGateway.edgeDevice")}
                                </FormLabel>
                                <FormControl
                                    type="select"
                                    ariaLabel={t(
                                        "devices.flyouts.linkOrUnlinkDevice.edgeDeviceLabel"
                                    )}
                                    className="long"
                                    link={this.edgeDeviceLink}
                                    onChange={this.onEdgeDeviceSelected}
                                    options={this.state.edgeDeviceOptions}
                                    placeholder={t(
                                        "devices.flyouts.linkOrUnlinkDevice.edgeDevicePlaceholder"
                                    )}
                                    clearable={false}
                                    searchable={false}
                                    disabled={changesApplied}
                                />
                            </FormGroup>
                        </div>
                        {error && (
                            <AjaxError
                                className="devices-new-error"
                                t={t}
                                error={error}
                            />
                        )}
                        {!changesApplied && (
                            <BtnToolbar>
                                <Btn
                                    primary={true}
                                    disabled={isPending || !this.formIsValid()}
                                    type="submit"
                                >
                                    {t("devices.flyouts.new.apply")}
                                </Btn>
                                <Btn
                                    svg={svgs.cancelX}
                                    onClick={() =>
                                        this.onFlyoutClose(
                                            "Devices_CancelClick"
                                        )
                                    }
                                >
                                    {t("devices.flyouts.new.cancel")}
                                </Btn>
                            </BtnToolbar>
                        )}
                        {!!changesApplied && (
                            <>
                                <br />
                                <Link
                                    to={`/maintenance/deviceJob/${this.state.message}`}
                                    className="btn btn-primary"
                                >
                                    {t("devices.flyouts.jobs.viewStatus")}
                                </Link>
                                <BtnToolbar>
                                    <Btn
                                        svg={svgs.cancelX}
                                        onClick={() =>
                                            this.onFlyoutClose(
                                                "Devices_CloseClick"
                                            )
                                        }
                                    >
                                        {t("devices.flyouts.new.close")}
                                    </Btn>
                                </BtnToolbar>
                            </>
                        )}
                    </form>
                </Protected>
            </Flyout>
        );
    }
}
