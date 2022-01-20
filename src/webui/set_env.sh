#!/bin/bash
# Copyright (c) 3M. All rights reserved.

if [ -n "$1" ] ; then
  echo "Using connection string argument in place of environment variable"
  AppConfigurationConnectionString=$1
fi

# Fetch App configuration
_get_configuration() {

  if value=$(az appconfig kv show --key $1  --connection-string $AppConfigurationConnectionString | jq .value); then
    echo $value
  else
    echo "Failed to ping Application Configuration: $1"
    echo
    echo "Exiting set_env.sh"
    exit 1
  fi

}
modify_webui_config() {

  value=$(_get_configuration "Global:AuthRequired" | sed 's/"//g' )
  sed -i 's/authEnabled.*/authEnabled: '$value',/g' /app/webui-config.js
  echo "Set AuthEnabled"

  value=$(_get_configuration "Global:ClientAuth:Jwt:AuthIssuer")
  sed -i 's@issuer.*@issuer: (window.location.protocol == "https:")?window.location.origin+"/auth":'$value',@g' /app/webui-config.js
  echo "Set Issuer"

  value=$(_get_configuration "Global:DevelopmentMode" | sed 's/"//g' )
  sed -i 's/developmentMode.*/developmentMode: '$value',/g' /app/webui-config.js
  echo "Set Development Mode: "$value

  value=$(_get_configuration "DeviceTelemetryService:Messages:TelemetryStorageType" | sed 's/"//g' )
  if [ $value == "ade" ]; then
    sed -i 's/isADXDeployed.*/isADXDeployed: true,/g' ./app/webui-config.js
  else
    sed -i 's/isADXDeployed.*/isADXDeployed: false,/g' /app/webui-config.js
  fi
  echo "Set ADX Deployed: "$value

}

main() {
  # For the script to fetch the secrets from key-vault foll. variable
  # AppConfigurationConnectionString must be available as "environment" variables.
  if [[ "$AppConfigurationConnectionString" != ""  ]]; then
    if az appconfig kv list  --connection-string $AppConfigurationConnectionString > /dev/null; then
        echo "Pinged Application Configuration Successfully"
    else
        echo "Failed to ping Application Configuration"
        echo
        echo "Exiting set_env.sh"
        exit 1
    fi

    modify_webui_config
    cat /app/src/utilities/policies.js
  else
    echo "Required AppConfiguration Connection String Infomation does not exist in Environment Variables, the following environment variables must be set to run this script:"
    echo "AppConfigurationConnectionString"
    echo
    echo "Exiting set_env.sh"
    exit 1
  fi
}

main