'use strict';

/* Dependencies */
import merge from 'deepmerge';
import RFC4122 from 'rfc4122';
import {
	HighSystems,
	HighSystemsOptions,
	HighSystemsRequest
} from '@highsystems/client';
import {
	HSField,
	HSFieldJSON
} from '@highsystems/field';

/* Globals */
const VERSION = require('../package.json').version;
const IS_BROWSER = typeof(window) !== 'undefined';
const rfc4122 = new RFC4122();

/* Main Class */
export class HSRecord<RecordData extends HSRecordData = HSRecordData> {

	public readonly CLASS_NAME = 'HSRecord';
	static readonly CLASS_NAME = 'HSRecord';

	static readonly VERSION: string = VERSION;

	/**
	 * The default settings of a `HighSystems` instance
	 */
	static defaults: HSRecordOptions = {
		highsystems: {
			instance: IS_BROWSER ? window.location.host.split('.')[0] : ''
		},

		applicationId: '',
		tableId: '',
		fids: {
			recordid: 'id'
		},

		recordid: undefined
	};

	/**
	 * An internal id (guid) used for tracking/managing object instances
	 */
	public id: string;

	private _hs: HighSystems;
	private _applicationId: string = '';
	private _tableId: string = '';
	private _fids: Record<string, string> = {};
	private _fields: HSField[] = [];
	private _data: Record<string, any> = {};

	constructor(options?: Partial<HSRecordOptions<RecordData>>){
		this.id = rfc4122.v4();

		const {
			highsystems,
			...classOptions
		} = options || {};

		if(HighSystems.IsHighSystems(highsystems)){
			this._hs = highsystems;
		}else{
			this._hs = new HighSystems(merge.all([
				HSRecord.defaults.highsystems,
				highsystems || {}
			]));
		}

		const settings = merge(HSRecord.defaults, classOptions);

		this
			.setApplicationId(settings.applicationId)
			.setTableId(settings.tableId)
			// @ts-expect-error
			.setFids(settings.fids)
			// @ts-expect-error
			.set('recordid', settings.recordid);

		return this;
	}

	clear(): this {
		this._data = {};
		this._fields = [];

		return this;
	}

	async delete({ requestOptions }: HighSystemsRequest = {}) {
		const recordid = this.get('recordid');

		if(recordid){
			const results = await this._hs.deleteRecord({
				appid: this.getApplicationId(),
				tableid: this.getTableId(),
				recordid: this.get('recordid'),
				requestOptions
			});

			if(results){
				this.clear();
			}

			return !!results;
		}else{
			this.clear();

			return true;
		}
	}

	get<F extends keyof RecordData>(field: F): RecordData[F];
	get<F extends string>(field: F): F extends keyof RecordData ? RecordData[F] : any;
	get(field: any): any {
		return this._data[field];
	}

	getFid<T extends keyof RecordData>(field: T): string;
	getFid(field: number, byId: true): string;
	getFid(field: string | number, byId?: false): string;
	getFid(field: string | number, byId: boolean = false): string {
		const fids = this.getFids();
		let id: string = '';

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
			id = '';
			field = +field;

			Object.entries(fids).some(([ name, fid ]) => {
				if(fid === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	}

	getFids(): HSFids<RecordData> {
		return this._fids as HSFids<RecordData>;
	}

	getField(id: string, returnIndex: true): number | undefined;
	getField(id: string, returnIndex?: false): HSField | undefined;
	getField(id: string, returnIndex: boolean = false): number | HSField | undefined {
		const fields = this.getFields();

		let result = undefined;

		for(let i = 0; result === undefined && i < fields.length; ++i){
			if(fields[i].getFid() === id){
				result = returnIndex ? i : fields[i];
			}
		}

		return result;
	}

	getFields(): HSField[] {
		return this._fields;
	}

	getApplicationId(): string {
		return this._applicationId;
	}

	getTableId(): string {
		return this._tableId;
	}

	async load({ clist, query, requestOptions }: HSRecordLoad = {}): Promise<Record<any, any>> {
		const where = [];

		let fids = this.getFids() as Record<any, any>;
		let select = [];

		if(query){
			where.push(`(${query})`);
		}

		if(this.get('recordid')){
			where.push(`{'${this.getFid('recordid')}'.=.'${this.get('recordid')}'}`);
		}

		if(clist){
			if(typeof(clist) === 'string'){
				// @ts-expect-error
				select = clist.split('.').map((val: string) => +val);
			}else{
				select = clist;
			}

			// @ts-expect-error
			fids = select.reduce((fids, fid) => {
				let name: string | number = this.getFid(fid, true);

				if(!name){
					name = fid;

					this.setFid(fid, fid);
				}

				fids[name] = fid;

				return fids;
			}, {} as Record<any, any>);
		}else{
			select = Object.entries(fids).map((fid) => {
				return fid[1];
			});
		}

		const results = await this._hs.getRecords({
			appid: this.getApplicationId(),
			tableid: this.getTableId(),
			query: where.join('AND'),
			columns: select,
			requestOptions
		});

		const record = results[0];

		if(!record){
			throw new Error('Record not found');
		}

		Object.entries(fids).forEach(([ name, fid ]) => {
			this.set(name, record[fid].value);
		});

		return this._data;
	}

	async loadSchema({ requestOptions }: HighSystemsRequest = {}): Promise<HSField[]> {
		const results = await this._hs.getFields({
			appid: this.getApplicationId(),
			tableid: this.getTableId(),
			requestOptions
		});

		// @ts-expect-error
		results.forEach((field) => {
			let result = this.getField(field.id);

			if(result === undefined){
				result = new HSField({
					highsystems: this._hs,
					applicationId: this.getApplicationId(),
					tableId: this.getTableId(),
					fid: field.id
				});

				this._fields.push(result);
			}

			Object.entries(field).forEach(([ property, value ]) => {
				result!.set(property, value);
			});
		});

		return this.getFields();
	}

	async save({
		fidsToSave,
		requestOptions
	}: HighSystemsRequest & {
		fidsToSave?: (keyof RecordData | string)[];
	} = {}): Promise<Record<any, any>> {
		const fids = this.getFids();
		const names = Object.entries(fids).map(([ name ]) => name);

		const results = await this._hs.upsertRecords({
			appid: this.getApplicationId(),
			tableid: this.getTableId(),
			data: [names.filter((name) => {
				const fid = fids[name];
				const filtered = !fidsToSave || fidsToSave.indexOf(fid) !== -1 || fidsToSave.indexOf(name) !== -1 || fid === 'id';
	
				if(!filtered){
					return false;
				}
	
				const field = this.getField(fid);
	
				if(field && [
					'lookup',
					'summary',
					'formula'
				].indexOf(field.get('type') || '') !== -1){
					return false;
				}
	
				return true;
			}).reduce((record, name) => {
				const fid = fids[name];
	
				if(fid){
					record[fid] = this.get(name);
				}
	
				return record;
			}, {} as Record<string, any>)],
			requestOptions
		});

		// @ts-expect-error
		this.set('recordid', results[0]);

		return this;
	}

	set<F extends keyof RecordData>(field: F, value: RecordData[F]): this;
	set<F extends string>(field: F, value: F extends keyof RecordData ? RecordData[F] : any): this;
	set(field: any, value: any): this {
		this._data[field] = value;

		return this;
	}

	setApplicationId(applicationId: string): this {
		this._applicationId = applicationId;

		return this;
	}

	setTableId(tableId: string): this {
		this._tableId = tableId;

		return this;
	}

	setFid<T extends keyof RecordData>(name: T, id: string): this;
	setFid(name: string, id: string): this;
	setFid(name: string, id: string): this {
		this._fids[name] = id;

		return this;
	}

	setFids(fields: Record<string, string>): this {
		Object.entries(fields).forEach(([ name, fid ]) => {
			this.setFid(name, fid);
		});

		return this;
	}

	setFields(fields: HSField[]): this {
		this._fields = fields;

		return this;
	}

	/**
	 * Rebuild the HSRecord instance from serialized JSON
	 *
	 * @param json HSRecord serialized JSON
	 */
	fromJSON(json: string | HSRecordJSON<RecordData>): this {
		if(typeof(json) === 'string'){
			json = JSON.parse(json);
		}

		if(typeof(json) !== 'object'){
			throw new TypeError('json argument must be type of object or a valid JSON string');
		}

		if(json.highsystems){
			this._hs = new HighSystems(json.highsystems);
		}

		if(json.applicationId){
			this.setApplicationId(json.applicationId);
		}

		if(json.tableId){
			this.setTableId(json.tableId);
		}

		if(json.fids){
			this.setFids(json.fids);
		}

		if(json.recordid){
			// @ts-ignore - my typescript skills fail me for now, tests are fine though
			this.set('recordid', json.recordid);
		}

		if(json.fields){
			json.fields.forEach((fieldJSON) => {
				this._fields.push(HSField.fromJSON(fieldJSON));
			});
		}

		if(json.data){
			Object.entries(json.data).forEach(([ property, value ]) => {
				// @ts-expect-error
				this.set(property, value);
			});
		}

		return this;
	}

	/**
	 * Serialize the HSRecord instance into JSON
	 */
	toJSON(fidsToConvert?: (string | number)[]): HSRecordJSON<RecordData> {
		return {
			highsystems: this._hs.toJSON(),
			applicationId: this.getApplicationId(),
			tableId: this.getTableId(),
			fids: this.getFids(),
			recordid: this.get('recordid'),
			fields: this.getFields().map((field) => {
				return field.toJSON();
			}),
			data: Object.entries(this._data).filter(([ name ]) => {
				return !fidsToConvert || fidsToConvert.indexOf(name) !== -1;
			}).reduce((data, [ name, value ]) => {
				data[name] = value;

				return data;
			}, {} as Record<any, any>)
		};
	}

	/**
	 * Create a new HSRecord instance from serialized JSON
	 *
	 * @param json HSRecord serialized JSON
	 */
	static fromJSON<T extends HSRecordData = HSRecordData>(json: string | HSRecordJSON<T>): HSRecord<T> {
		if(typeof(json) === 'string'){
			json = JSON.parse(json);
		}

		if(typeof(json) !== 'object'){
			throw new TypeError('json argument must be type of object or a valid JSON string');
		}

		const newRecord = new HSRecord();

		// @ts-expect-error
		return newRecord.fromJSON(json);
	}

	/**
	 * Test if a variable is a `@highsystems/record` object
	 *
	 * @param obj A variable you'd like to test
	 */
	static IsHSRecord<T extends HSRecordData = HSRecordData>(obj: any): obj is HSRecord<T> {
		return ((obj || {}) as HSRecord).CLASS_NAME === HSRecord.CLASS_NAME;
	}

	/**
	 * Returns a new HSRecord instance built off of `options`, that inherits configuration data from the passed in `data` argument.
	 *
	 * @param options HSRecord instance options
	 * @param data Quick Base Record data
	 */
	static NewRecord<T extends HSRecordData = HSRecordData>(options: Partial<HSRecordOptions<T>>, data?: Partial<T>): HSRecord<T> {
		const newRecord = new HSRecord<T>(options);

		if(data){
			Object.entries(data).forEach(([ property, value ]) => {
				newRecord.set(property, value);
			});
		}

		return newRecord;
	};

}

/* Helpers */
export const replaceUndefinedWithString = (val: any) => {
	return val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? '' : val
};

/* Types */
export type HSRecordLoad = HighSystemsRequest & {
	query?: string;
	clist?: string[];
}

export type HSRecordData = Record<string, string>;
export type HSFids<T extends HSRecordData> = {
	[K in keyof T]: string;
};

export type HSRecordOptions<RecordData extends HSRecordData = {
	recordid: string;
}> = {
	highsystems: HighSystems | HighSystemsOptions;
	applicationId: string;
	tableId: string;
	fids: Partial<HSFids<RecordData>>,
	recordid?: string;
}

export type HSRecordJSON<RecordData extends HSRecordData = {
	recordid: string;
}>  = {
	highsystems: HighSystemsOptions;
	applicationId: string;
	tableId: string;
	fids: HSFids<RecordData>;
	recordid: string;
	fields: HSFieldJSON[];
	data: RecordData;
}

/* Export to Browser */
if(IS_BROWSER){
	window.HSRecord = exports;
}
