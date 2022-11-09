import { AppConfig } from '@backstage/config';
import { JSONSchema7 } from 'json-schema';
import { JsonObject } from '@backstage/types';

/**
 * Read runtime configuration from the environment.
 *
 * Only environment variables prefixed with APP_CONFIG_ will be considered.
 *
 * For each variable, the prefix will be removed, and rest of the key will
 * be split by '_'. Each part will then be used as keys to build up a nested
 * config object structure. The treatment of the entire environment variable
 * is case-sensitive.
 *
 * The value of the variable should be JSON serialized, as it will be parsed
 * and the type will be kept intact. For example "true" and true are treated
 * differently, as well as "42" and 42.
 *
 * For example, to set the config app.title to "My Title", use the following:
 *
 * APP_CONFIG_app_title='"My Title"'
 *
 * @public
 */
declare function readEnvConfig(env: {
    [name: string]: string | undefined;
}): AppConfig[];

/**
 * A type representing the possible configuration value visibilities
 *
 * @public
 */
declare type ConfigVisibility = 'frontend' | 'backend' | 'secret';
/**
 * A function used to transform primitive configuration values.
 *
 * @public
 */
declare type TransformFunc<T extends number | string | boolean> = (value: T, context: {
    visibility: ConfigVisibility;
}) => T | undefined;
/**
 * Options used to process configuration data with a schema.
 *
 * @public
 */
declare type ConfigSchemaProcessingOptions = {
    /**
     * The visibilities that should be included in the output data.
     * If omitted, the data will not be filtered by visibility.
     */
    visibility?: ConfigVisibility[];
    /**
     * When set to `true`, any schema errors in the provided configuration will be ignored.
     */
    ignoreSchemaErrors?: boolean;
    /**
     * A transform function that can be used to transform primitive configuration values
     * during validation. The value returned from the transform function will be used
     * instead of the original value. If the transform returns `undefined`, the value
     * will be omitted.
     */
    valueTransform?: TransformFunc<any>;
    /**
     * Whether or not to include the `filteredKeys` property in the output `AppConfig`s.
     *
     * Default: `false`.
     */
    withFilteredKeys?: boolean;
    /**
     * Whether or not to include the `deprecatedKeys` property in the output `AppConfig`s.
     *
     * Default: `true`.
     */
    withDeprecatedKeys?: boolean;
};
/**
 * A loaded configuration schema that is ready to process configuration data.
 *
 * @public
 */
declare type ConfigSchema = {
    process(appConfigs: AppConfig[], options?: ConfigSchemaProcessingOptions): AppConfig[];
    serialize(): JsonObject;
};

/**
 * Given a list of configuration schemas from packages, merge them
 * into a single json schema.
 *
 * @public
 */
declare function mergeConfigSchemas(schemas: JSONSchema7[]): JSONSchema7;

/**
 * Options that control the loading of configuration schema files in the backend.
 *
 * @public
 */
declare type LoadConfigSchemaOptions = {
    dependencies: string[];
    packagePaths?: string[];
} | {
    serialized: JsonObject;
};
/**
 * Loads config schema for a Backstage instance.
 *
 * @public
 */
declare function loadConfigSchema(options: LoadConfigSchemaOptions): Promise<ConfigSchema>;

/** @public */
declare type ConfigTarget = {
    path: string;
} | {
    url: string;
};
/** @public */
declare type LoadConfigOptionsWatch = {
    /**
     * A listener that is called when a config file is changed.
     */
    onChange: (configs: AppConfig[]) => void;
    /**
     * An optional signal that stops the watcher once the promise resolves.
     */
    stopSignal?: Promise<void>;
};
/** @public */
declare type LoadConfigOptionsRemote = {
    /**
     * A remote config reloading period, in seconds
     */
    reloadIntervalSeconds: number;
};
/**
 * Options that control the loading of configuration files in the backend.
 *
 * @public
 */
declare type LoadConfigOptions = {
    configRoot: string;
    configTargets: ConfigTarget[];
    /**
     * Custom environment variable loading function
     *
     * @experimental This API is not stable and may change at any point
     */
    experimentalEnvFunc?: (name: string) => Promise<string | undefined>;
    /**
     * An optional remote config
     */
    remote?: LoadConfigOptionsRemote;
    /**
     * An optional configuration that enables watching of config files.
     */
    watch?: LoadConfigOptionsWatch;
};
/**
 * Results of loading configuration files.
 * @public
 */
declare type LoadConfigResult = {
    /**
     * Array of all loaded configs.
     */
    appConfigs: AppConfig[];
};
/**
 * Load configuration data.
 *
 * @public
 */
declare function loadConfig(options: LoadConfigOptions): Promise<LoadConfigResult>;

export { ConfigSchema, ConfigSchemaProcessingOptions, ConfigTarget, ConfigVisibility, LoadConfigOptions, LoadConfigOptionsRemote, LoadConfigOptionsWatch, LoadConfigResult, LoadConfigSchemaOptions, TransformFunc, loadConfig, loadConfigSchema, mergeConfigSchemas, readEnvConfig };
