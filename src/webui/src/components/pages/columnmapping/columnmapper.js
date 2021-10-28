// Copyright (c) Microsoft. All rights reserved.

import React, { Fragment } from "react";

import { toDiagnosticsModel } from "services/models";
import { svgs, LinkedComponent, Validator } from "utilities";
import {
    AjaxError,
    Btn,
    BtnToolbar,
    FormGroup,
    FormLabel,
    FormControl,
    PropertyRow as Row,
    PropertyCell as Cell,
    PropertyGrid as Grid,
    Indicator,
} from "components/shared";
import { ConfigService, IoTHubManagerService } from "services";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import dragIndicator from "assets/icons/drag_indicator.svg";

const classnames = require("classnames/bind");
const css = classnames.bind(require("./columnMapping.module.scss"));

const toOption = (value, label) => ({
    label: label || value,
    value,
});

// A counter for creating unique keys per new condition
let conditionKey = 0;

const newColumnMapping = () => ({
    name: undefined,
    mapping: undefined,
    cellRenderer: undefined,
    description: "",
    key: conditionKey++, // Used by react to track the rendered elements
});

export class ColumnMapper extends LinkedComponent {
    constructor(props) {
        super(props);
        this.state = {
            mappingOptions: [
                {
                    label: "lastActivity",
                    value: "lastActivity",
                },
                {
                    label: "isSimulated",
                    value: "isSimulated",
                },
                {
                    label: "c2DMessageCount",
                    value: "c2DMessageCount",
                },
                {
                    label: "enabled",
                    value: "enabled",
                },
                {
                    label: "lastStatusUpdated",
                    value: "lastStatusUpdated",
                },
                {
                    label: "ioTHubHostName",
                    value: "ioTHubHostName",
                },
                {
                    label: "eTag",
                    value: "eTag",
                },
                {
                    label: "authentication",
                    value: "authentication",
                },
                {
                    label: "Properties.Reported.Type",
                    value: "Properties.Reported.Type",
                },
                {
                    label: "Properties.Reported.firmware.currentFwVersion",
                    value: "Properties.Reported.firmware.currentFwVersion",
                },
                {
                    label: "Properties.Reported.telemetry",
                    value: "Properties.Reported.telemetry",
                },
                {
                    label: "connected",
                    value: "connected",
                },
                {
                    label: "errorLogCount",
                    value: "errorLogCount",
                },
            ],
            rendererOptions: [
                { label: "SimulatedRenderer", value: "IsSimulatedRenderer" },
                {
                    label: "ConnectionStatusRenderer",
                    value: "ConnectionStatusRenderer",
                },
                { label: "TimeRenderer", value: "TimeRenderer" },
                { label: "DefaultRenderer", value: "DefaultRenderer" },
            ],
            mappingId: this.props.mappingId || "",
            isEdit: this.props.isEdit || false,
            isDefault: this.props.isDefault || false,
            isAdd: this.props.isAdd || false,
            mappingName: (this.props.columnMapping || {}).name,
            eTag: (this.props.columnMapping || {}).eTag,
            columnMappings: (this.props.columnMapping || {}).mapping || [],
            defaultColumnMappings:
                (this.props.defaultColumnMapping || {}).mapping || [],
            isPending: true,
            error: undefined,
            mappingsLink: this.linkTo("columnMappings"),
        };

        // State to input links
        this.mappingsLink = this.linkTo("columnMappings");
        this.defaultMappingsLink = this.linkTo("defaultColumnMappings");
        this.mappingNameLink = this.linkTo("mappingName").check(
            Validator.notEmpty,
            this.props.t("deviceQueryConditions.errorMsg.fieldCantBeEmpty")
        );
    }

    conditionIsNew(condition) {
        return !condition.field && !condition.operator && !condition.value;
    }

    formIsValid() {
        return [this.state.mappingsLink].every((link) => !link.error);
    }

    componentDidMount() {
        this.subscription =
            IoTHubManagerService.getDeviceProperties().subscribe(
                (items) => {
                    const filterOptions = items
                        .filter(
                            (item) =>
                                !this.state.mappingOptions
                                    .map((m) => m.value)
                                    .includes(item)
                        )
                        .map((item) => toOption(item));
                    this.setState({
                        mappingOptions: [
                            ...this.state.mappingOptions,
                            ...filterOptions,
                        ],
                    });
                },
                (filtersError) => this.setState({ filtersError })
            );

        if (!this.props.isPending) {
            this.setState({
                mappingName: (this.props.columnMapping || {}).name,
                eTag: (this.props.columnMapping || {}).eTag,
                columnMappings: (this.props.columnMapping || {}).mapping || [],
                defaultColumnMappings:
                    (this.props.defaultColumnMapping || {}).mapping || [],
                isPending: this.props.isPending,
            });
        }
    }

    static getDerivedStateFromProps(props, state) {
        if (props.isPending !== state.isPending) {
            if (!props.isPending) {
                return {
                    mappingName: (props.columnMapping || {}).name,
                    eTag: (props.columnMapping || {}).eTag,
                    columnMappings: (props.columnMapping || {}).mapping || [],
                    defaultColumnMappings:
                        (props.defaultColumnMapping || {}).mapping || [],
                    isPending: props.isPending,
                };
            } else {
                return {
                    isPending: props.isPending,
                };
            }
        }

        return null;
    }

    componentWillUnmount() {
        if (this.subscription) this.subscription.unsubscribe();
        if (this.state.refreshDeviceData) {
            this.props.fetchDevices();
        }
    }

    apply = (event) => {
        event.preventDefault();

        var requestData = {
            Id: this.state.mappingId,
            ETag: this.state.eTag,
            ColumnMappingDefinitions: this.state.columnMappings,
            Name: this.state.mappingName,
            IsDefault: this.state.isDefault,
        };
        if (this.state.mappingId && this.state.eTag) {
            ConfigService.updateColumnMappings(
                this.state.mappingId,
                requestData
            ).subscribe(
                (columnMapping) => {
                    this.redirect(true);
                },
                (error) => {}
            );
        } else {
            ConfigService.createColumnMappings(requestData).subscribe(
                (columnMapping) => {
                    this.redirect(true);
                },
                (error) => {}
            );
        }
    };

    redirect = (afterSave = false) => {
        if (afterSave) {
            this.props.fetchColumnMappings();
            this.setState({ refreshDeviceData: true });
        }
        if (this.state.isDefault) {
            this.props.history.push(`/columnMapping/default`);
        } else {
            this.props.history.push(`/columnMapping/custom`);
        }
    };

    addCondition = () => {
        this.props.logEvent(
            toDiagnosticsModel("CreateColumnMapping_AddColumnMapping", {})
        );
        var mappingsLink = this.state.mappingsLink;
        mappingsLink.set([
            ...this.state.mappingsLink.value,
            newColumnMapping(),
        ]);
        this.setState({ mappingsLink: mappingsLink });
        return mappingsLink;
    };

    deleteCondition = (index) => () => {
        this.props.logEvent(
            toDiagnosticsModel("CreateColumnMapping_DeleteColumnMapping", {})
        );
        var mappingsLink = this.state.mappingsLink;
        mappingsLink.set([
            ...this.state.mappingsLink.value.filter((_, idx) => index !== idx),
        ]);
        return this.setState({ mappingsLink: mappingsLink });
    };

    resetColumnMappings = () => {
        this.setState(
            {
                columnMappings: (this.props.columnMapping || {}).mapping || [],
            },
            () => {
                this.render();
            }
        );
    };

    onReset = () => {
        this.props.logEvent(
            toDiagnosticsModel("CreateColumnMappings_Reset", {})
        );
        this.resetColumnMappings();
    };

    onCancel = () => {
        this.props.logEvent(
            toDiagnosticsModel("CreateColumnMappings_Cancel", {})
        );
        if (this.state.isDefault) {
            this.props.history.push(`/columnMapping/default`);
        } else {
            this.props.history.push(`/columnMapping/custom`);
        }
    };

    operatorOptionArr = (options, key) => {
        var optionArr = options;
        if (
            this.state.deviceQueryConditions.length > 0 &&
            this.state.deviceQueryConditions[key].field !== "deviceId"
        ) {
            optionArr = optionArr.filter((option) => option.value !== "LK");
            if (this.state.deviceQueryConditions[key].operator === "LK") {
                this.state.deviceQueryConditions[key].operator = undefined;
            }
        }

        return optionArr;
    };

    handleOnDragEnd = (event) => {
        if (!event.destination) return;
        const items = Array.from(this.state.mappingsLink.value);
        const [reorderedItem] = items.splice(event.source.index, 1);
        items.splice(event.destination.index, 0, reorderedItem);
        var mappingsLink = this.state.mappingsLink;
        mappingsLink.set(items);
        this.setState({ mappingsLink: mappingsLink });
    };

    areMappingsSame() {
        if (
            this.props.columnMapping &&
            this.props.columnMapping.mapping &&
            this.state.mappingsLink
        ) {
            return (
                JSON.stringify(this.state.mappingsLink.value) ===
                JSON.stringify(this.props.columnMapping.mapping)
            );
        }
        return false;
    }

    render() {
        const { t } = this.props,
            // Create the state link for the dynamic form elements
            mappingsLink = this.state.mappingsLink.getLinkedChildren(
                (conditionLink) => {
                    let name = conditionLink
                            .forkTo("name")
                            .check(
                                Validator.notEmpty,
                                t("columnMapping.errorMsg.headerCannotBeEmpty")
                            )
                            .check(
                                Validator.notDuplicated,
                                t("columnMapping.errorMsg.nameIsDuplicated"),
                                !this.state.isDefault
                                    ? [
                                          ...this.state.defaultColumnMappings,
                                          ...this.state.columnMappings,
                                      ].map((m) => m.name)
                                    : this.state.columnMappings.map(
                                          (m) => m.name
                                      )
                            ),
                        mapping = conditionLink
                            .forkTo("mapping")
                            .map(({ value }) => value)
                            .check(
                                Validator.notEmpty,
                                t("columnMapping.errorMsg.mappingCannotBeEmpty")
                            )
                            .check(
                                Validator.notDuplicated,
                                t("columnMapping.errorMsg.mappingIsDuplicated"),
                                !this.state.isDefault
                                    ? [
                                          ...this.state.defaultColumnMappings,
                                          ...this.state.columnMappings,
                                      ].map((m) => m.mapping)
                                    : this.state.columnMappings.map(
                                          (m) => m.mapping
                                      )
                            ),
                        renderer = conditionLink
                            .forkTo("cellRenderer")
                            .map(({ value }) => value)
                            .check(
                                Validator.notEmpty,
                                t(
                                    "columnMapping.errorMsg.rendererCannotBeEmpty"
                                )
                            ),
                        description = conditionLink.forkTo("description"),
                        edited = !(
                            !name.value &&
                            !mapping.value &&
                            !renderer.value &&
                            !description.value
                        );
                    let error =
                        name.error ||
                        mapping.error ||
                        renderer.error ||
                        description.error ||
                        "";
                    return {
                        name,
                        mapping,
                        renderer,
                        description,
                        edited,
                        error,
                    };
                }
            ),
            defaultMappingsLink = this.defaultMappingsLink.getLinkedChildren(
                (conditionLink) => {
                    let name = conditionLink
                            .forkTo("name")
                            .check(
                                Validator.notEmpty,
                                t("columnMapping.errorMsg.headerCannotBeEmpty")
                            )
                            .check(
                                Validator.notDuplicated,
                                t("columnMapping.errorMsg.nameIsDuplicated"),
                                this.state.columnMappings.map((m) => m.name)
                            ),
                        mapping = conditionLink
                            .forkTo("mapping")
                            .map(({ value }) => value)
                            .check(
                                Validator.notEmpty,
                                t("columnMapping.errorMsg.mappingCannotBeEmpty")
                            )
                            .check(
                                Validator.notDuplicated,
                                t("columnMapping.errorMsg.mappingIsDuplicated"),
                                this.state.columnMappings.map((m) => m.mapping)
                            ),
                        renderer = conditionLink
                            .forkTo("cellRenderer")
                            .map(({ value }) => value)
                            .check(
                                Validator.notEmpty,
                                t(
                                    "columnMapping.errorMsg.rendererCannotBeEmpty"
                                )
                            ),
                        description = conditionLink.forkTo("description"),
                        edited = !(
                            !name.value &&
                            !mapping.value &&
                            !renderer.value &&
                            !description.value
                        );
                    let error =
                        name.error ||
                        mapping.error ||
                        renderer.error ||
                        description.error ||
                        "";
                    return {
                        name,
                        mapping,
                        renderer,
                        description,
                        edited,
                        error,
                    };
                }
            ),
            conditionHasErrors =
                defaultMappingsLink.some(({ error }) => !!error) ||
                mappingsLink.some(({ error }) => !!error);
        return (
            <Fragment>
                {!(this.state.isDefault || this.state.isEdit) && (
                    <FormGroup>
                        <FormLabel>
                            {t("columnMapping.labels.mappingName")}
                        </FormLabel>
                        <FormControl
                            type="text"
                            aria-label={t("columnMapping.field")}
                            className="long"
                            searchable="false"
                            clearable="false"
                            placeholder={t("columnMapping.namePlaceHolder")}
                            link={this.mappingNameLink}
                        />
                    </FormGroup>
                )}
                {!this.state.isDefault && this.state.isEdit && (
                    <p>{this.state.mappingName}</p>
                )}
                {this.state.isPending && (
                    <Indicator size="large" pattern="bar" />
                )}
                <form onSubmit={this.apply}>
                    <div className={css("manage-filters-container")}>
                        <Grid>
                            {(defaultMappingsLink.length > 0 ||
                                mappingsLink.length > 0) && (
                                <Row>
                                    <Cell className="col-1 button"></Cell>
                                    <Cell className="col-1 button"></Cell>
                                    <Cell className="col-3">Name</Cell>
                                    <Cell className="col-1"></Cell>
                                    <Cell className="col-2">Mapping</Cell>
                                    <Cell className="col-1"></Cell>
                                    <Cell className="col-2">Renderer</Cell>
                                    <Cell className="col-1"></Cell>
                                    <Cell className="col-3">Description</Cell>
                                </Row>
                            )}
                            {!this.state.isDefault &&
                                defaultMappingsLink.map((condition, idx) => (
                                    <Row
                                        key={idx}
                                        // className="deviceExplorer-conditions"
                                    >
                                        <Cell className="col-1 button"></Cell>
                                        <Cell className="col-3">
                                            <FormControl
                                                type="text"
                                                aria-label={t(
                                                    "columnMapping.field"
                                                )}
                                                className="long"
                                                disabled={true}
                                                searchable="false"
                                                clearable="false"
                                                placeholder={t(
                                                    "columnMapping.headerPlaceholder"
                                                )}
                                                link={condition.name}
                                            />
                                        </Cell>
                                        <Cell className="col-1"></Cell>
                                        <Cell className="col-2">
                                            <FormControl
                                                type="select"
                                                aria-label={t(
                                                    "columnMapping.mapping"
                                                )}
                                                className="long"
                                                disabled={true}
                                                searchable="false"
                                                clearable="false"
                                                options={
                                                    this.state.mappingOptions
                                                }
                                                placeholder={t(
                                                    "columnMapping.mappingPlaceholder"
                                                )}
                                                link={condition.mapping}
                                            />
                                        </Cell>
                                        <Cell className="col-1"></Cell>
                                        <Cell className="col-2">
                                            <FormControl
                                                type="select"
                                                aria-label={t(
                                                    "columnMapping.renderer"
                                                )}
                                                className="long"
                                                disabled={true}
                                                searchable="false"
                                                clearable="false"
                                                options={
                                                    this.state.rendererOptions
                                                }
                                                placeholder={t(
                                                    "columnMapping.renderPlaceholder"
                                                )}
                                                link={condition.renderer}
                                            />
                                        </Cell>
                                        <Cell className="col-1"></Cell>
                                        <Cell className="col-3">
                                            <FormControl
                                                type="text"
                                                placeholder={t(
                                                    "columnMapping.descriptionPlaceholder"
                                                )}
                                                link={condition.description}
                                                className={css("width-70")}
                                            />
                                        </Cell>
                                    </Row>
                                ))}
                            <DragDropContext
                                onDragEnd={(e) =>
                                    this.handleOnDragEnd(e, mappingsLink)
                                }
                            >
                                <Droppable droppableId="characters">
                                    {(provided) => (
                                        <div
                                            className={css("list")}
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                        >
                                            {mappingsLink.map(
                                                (condition, idx) => {
                                                    return (
                                                        <Draggable
                                                            key={
                                                                "draggable" +
                                                                idx
                                                            }
                                                            draggableId={
                                                                "draggable" +
                                                                idx
                                                            }
                                                            index={idx}
                                                        >
                                                            {(provided) => (
                                                                <Row
                                                                    key={idx}
                                                                    provided={
                                                                        provided
                                                                    }
                                                                    onMouseEnter={
                                                                        this
                                                                            .onMouseEnter
                                                                    }
                                                                    className={css(
                                                                        "item"
                                                                    )}
                                                                >
                                                                    <img
                                                                        className={css(
                                                                            "dragIndicator"
                                                                        )}
                                                                        src={
                                                                            dragIndicator
                                                                        }
                                                                        alt={t(
                                                                            "deviceGroupsFlyout.unpinned"
                                                                        )}
                                                                    />
                                                                    <Cell className="col-1 button">
                                                                        <Btn
                                                                            className="btn-icon"
                                                                            icon="cancel"
                                                                            onClick={this.deleteCondition(
                                                                                idx
                                                                            )}
                                                                        />
                                                                    </Cell>
                                                                    <Cell className="col-3">
                                                                        <FormControl
                                                                            type="text"
                                                                            aria-label={t(
                                                                                "columnMapping.field"
                                                                            )}
                                                                            className="long"
                                                                            searchable="false"
                                                                            clearable="false"
                                                                            placeholder={t(
                                                                                "columnMapping.headerPlaceholder"
                                                                            )}
                                                                            link={
                                                                                condition.name
                                                                            }
                                                                        />
                                                                    </Cell>
                                                                    <Cell className="col-1"></Cell>
                                                                    <Cell className="col-2">
                                                                        <FormControl
                                                                            type="select"
                                                                            aria-label={t(
                                                                                "columnMapping.operator"
                                                                            )}
                                                                            className="long"
                                                                            searchable="false"
                                                                            clearable="false"
                                                                            options={
                                                                                this
                                                                                    .state
                                                                                    .mappingOptions
                                                                            }
                                                                            placeholder={t(
                                                                                "columnMapping.mappingPlaceholder"
                                                                            )}
                                                                            link={
                                                                                condition.mapping
                                                                            }
                                                                        />
                                                                    </Cell>
                                                                    <Cell className="col-1"></Cell>
                                                                    <Cell className="col-2">
                                                                        <FormControl
                                                                            type="select"
                                                                            aria-label={t(
                                                                                "columnMapping.operator"
                                                                            )}
                                                                            className="long"
                                                                            searchable="false"
                                                                            clearable="false"
                                                                            options={
                                                                                this
                                                                                    .state
                                                                                    .rendererOptions
                                                                            }
                                                                            placeholder={t(
                                                                                "columnMapping.renderPlaceholder"
                                                                            )}
                                                                            link={
                                                                                condition.renderer
                                                                            }
                                                                        />
                                                                    </Cell>
                                                                    <Cell className="col-1"></Cell>
                                                                    <Cell className="col-3">
                                                                        <FormControl
                                                                            type="text"
                                                                            placeholder={t(
                                                                                "columnMapping.descriptionPlaceholder"
                                                                            )}
                                                                            link={
                                                                                condition.description
                                                                            }
                                                                            className={css(
                                                                                "width-70"
                                                                            )}
                                                                        />
                                                                    </Cell>
                                                                </Row>
                                                            )}
                                                        </Draggable>
                                                    );
                                                }
                                            )}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </Grid>
                        <Btn
                            className={css("add-btn")}
                            svg={svgs.plus}
                            onClick={this.addCondition}
                        >
                            Add a Mapping
                        </Btn>
                        <div className={css("cancel-right-div")}>
                            <BtnToolbar>
                                <Btn
                                    primary
                                    disabled={
                                        !this.formIsValid() ||
                                        this.areMappingsSame() ||
                                        conditionHasErrors ||
                                        (!this.state.isDefault &&
                                            this.mappingNameLink.error) ||
                                        this.state.isPending ||
                                        this.state.columnMappings.length === 0
                                    }
                                    type="submit"
                                >
                                    Save
                                </Btn>
                                <Btn
                                    disabled={this.state.isPending}
                                    svg={svgs.cancelX}
                                    onClick={this.onReset}
                                >
                                    Reset
                                </Btn>
                                {!this.state.isDefault && (
                                    <Btn
                                        svg={svgs.cancelX}
                                        onClick={this.onCancel}
                                    >
                                        Cancel
                                    </Btn>
                                )}
                            </BtnToolbar>
                        </div>
                        {this.state.error && (
                            <AjaxError t={t} error={this.state.error} />
                        )}
                    </div>
                </form>
            </Fragment>
        );
    }
}
