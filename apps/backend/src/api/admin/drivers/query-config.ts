import { defaultDriverFields } from "../../drivers/query-config"

export const retrieveAdminDriverTransformQueryConfig = {
  defaults: defaultDriverFields,
  isList: false,
}

export const listAdminDriversTransformQueryConfig = {
  ...retrieveAdminDriverTransformQueryConfig,
  defaultLimit: 20,
  isList: true,
}
