/* eslint-disable */
/* prettier-ignore */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
// Generated by federation

declare module "team-green/Recommendations" {
	import * as vue from 'vue';
	import { PropType } from 'vue';
	
	declare const _default: {
	    new (...args: any[]): {
	        $: vue.ComponentInternalInstance;
	        $data: {};
	        $props: Partial<{}> & Omit<Readonly<vue.ExtractPropTypes<{
	            name: {
	                type: PropType<string>;
	                required: true;
	            };
	        }>> & vue.VNodeProps & vue.AllowedComponentProps & vue.ComponentCustomProps, never>;
	        $attrs: {
	            [x: string]: unknown;
	        };
	        $refs: {
	            [x: string]: unknown;
	        };
	        $slots: Readonly<{
	            [name: string]: vue.Slot | undefined;
	        }>;
	        $root: vue.ComponentPublicInstance<{}, {}, {}, {}, {}, {}, {}, {}, false, vue.ComponentOptionsBase<any, any, any, any, any, any, any, any, any, {}, {}, string>, {}> | null;
	        $parent: vue.ComponentPublicInstance<{}, {}, {}, {}, {}, {}, {}, {}, false, vue.ComponentOptionsBase<any, any, any, any, any, any, any, any, any, {}, {}, string>, {}> | null;
	        $emit: (event: string, ...args: any[]) => void;
	        $el: any;
	        $options: vue.ComponentOptionsBase<Readonly<vue.ExtractPropTypes<{
	            name: {
	                type: PropType<string>;
	                required: true;
	            };
	        }>>, {}, unknown, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, {}, {}, string> & {
	            beforeCreate?: ((() => void) | (() => void)[]) | undefined;
	            created?: ((() => void) | (() => void)[]) | undefined;
	            beforeMount?: ((() => void) | (() => void)[]) | undefined;
	            mounted?: ((() => void) | (() => void)[]) | undefined;
	            beforeUpdate?: ((() => void) | (() => void)[]) | undefined;
	            updated?: ((() => void) | (() => void)[]) | undefined;
	            activated?: ((() => void) | (() => void)[]) | undefined;
	            deactivated?: ((() => void) | (() => void)[]) | undefined;
	            beforeDestroy?: ((() => void) | (() => void)[]) | undefined;
	            beforeUnmount?: ((() => void) | (() => void)[]) | undefined;
	            destroyed?: ((() => void) | (() => void)[]) | undefined;
	            unmounted?: ((() => void) | (() => void)[]) | undefined;
	            renderTracked?: (((e: vue.DebuggerEvent) => void) | ((e: vue.DebuggerEvent) => void)[]) | undefined;
	            renderTriggered?: (((e: vue.DebuggerEvent) => void) | ((e: vue.DebuggerEvent) => void)[]) | undefined;
	            errorCaptured?: (((err: unknown, instance: vue.ComponentPublicInstance<{}, {}, {}, {}, {}, {}, {}, {}, false, vue.ComponentOptionsBase<any, any, any, any, any, any, any, any, any, {}, {}, string>, {}> | null, info: string) => boolean | void) | ((err: unknown, instance: vue.ComponentPublicInstance<{}, {}, {}, {}, {}, {}, {}, {}, false, vue.ComponentOptionsBase<any, any, any, any, any, any, any, any, any, {}, {}, string>, {}> | null, info: string) => boolean | void)[]) | undefined;
	        };
	        $forceUpdate: () => void;
	        $nextTick: typeof vue.nextTick;
	        $watch<T extends string | ((...args: any) => any)>(source: T, cb: T extends (...args: any) => infer R ? (args_0: R, args_1: R) => any : (...args: any) => any, options?: vue.WatchOptions<boolean> | undefined): vue.WatchStopHandle;
	    } & Readonly<vue.ExtractPropTypes<{
	        name: {
	            type: PropType<string>;
	            required: true;
	        };
	    }>> & vue.ShallowUnwrapRef<{}> & {} & vue.ComponentCustomProperties & {};
	    __isFragment?: undefined;
	    __isTeleport?: undefined;
	    __isSuspense?: undefined;
	} & vue.ComponentOptionsBase<Readonly<vue.ExtractPropTypes<{
	    name: {
	        type: PropType<string>;
	        required: true;
	    };
	}>>, {}, unknown, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, {}, {}, string> & vue.VNodeProps & vue.AllowedComponentProps & vue.ComponentCustomProps & (new () => {
	    $slots: {};
	});
	
	export { _default as default };
	
}