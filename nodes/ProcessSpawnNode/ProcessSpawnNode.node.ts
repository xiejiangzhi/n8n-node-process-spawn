import { IExecuteFunctions } from 'n8n-core';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { spawnSync } from 'child_process'

export class ProcessSpawnNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Process Spawn Node',
		name: 'ProcessSpawnNode',
		group: ['transform'],
		version: 1,
		description: 'Spawn a child process to exec a system command. with stdin iinput',
		defaults: {
			name: 'ProcessSpawnNode',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
      {
				displayName: 'Command',
				name: 'Cmd',
				type: 'string',
				default: "",
				placeholder: 'ls',
				description: 'Command to exec',
			},
      {
				displayName: 'Args',
				name: 'Args',
				type: 'fixedCollection',
				default: { args: [] },
        typeOptions: { multipleValues: true },
        options: [
          {
            name: 'args',
            displayName: 'Args',
            values: [
              { displayName: 'Arg', name: 'arg', type: 'string', default: '' }
            ]
          }
        ],
				placeholder: '',
				description: 'Command args list',
			},
			{
				displayName: 'Envs',
				name: 'Envs',
				type: 'fixedCollection',
				default: { envs: [] },
        typeOptions: { multipleValues: true },
        options: [
          {
            name: 'envs',
            displayName: 'Envs',
            values: [
              { displayName: 'Name', name: 'name', type: 'string', default: '' },
              { displayName: 'Value', name: 'value', type: 'string', default: '' }
            ]
          }
        ],
				placeholder: '',
				description: 'Command environment',
			},
      {
				displayName: 'Working Dir',
				name: 'WorkingDir',
				type: 'string',
				default: '',
				placeholder: '',
				description: 'Working dir, optional',
			},
      {
				displayName: 'StdoutFormat',
				name: 'StdoutFormat',
				type: 'options',
				default: 'json',
        options: [
          { name: 'JSON', value: 'json' },
          { name: 'Plain', value: 'plain' }
        ],
				description: 'How to parse stdout',
			}
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let Cmd: string;
		let Args;
		let Envs;
		let WorkingDir: string;
		let StdoutFormat: string;

		// Iterates over all input items and add the key "myString" with the
		// value the parameter "myString" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				Cmd = this.getNodeParameter('Cmd', itemIndex, '') as string;
				Args = this.getNodeParameter('Args.args', itemIndex, []) as [{ arg: string }];
        let cmd_args = Args.map(v => { return v.arg });
				Envs = this.getNodeParameter('Envs.envs', itemIndex, []) as [{ name: string, value: string }];
        let cmd_envs: {[key: string]: string}  = { ...process.env } as {[key: string]: string};
        Envs.forEach(item => { cmd_envs[item.name] = item.value; });

				WorkingDir = this.getNodeParameter('WorkingDir', itemIndex, '') as string;
        WorkingDir = WorkingDir.trim();
				StdoutFormat = this.getNodeParameter('StdoutFormat', itemIndex, '') as string;
				item = items[itemIndex];
        let r = spawnSync(Cmd, cmd_args, {
          cwd: WorkingDir || undefined,
          env: cmd_envs,
          input: item.json ? JSON.stringify(item.json) : undefined
        });
        if (r?.status === 0) {
          let out_str = r.stdout.toString();
          switch(StdoutFormat) {
          case "json":
            out_str = out_str.trim();
            if (out_str) {
              item.json = JSON.parse(out_str)
            } else {
              item.json = {};
            }
            break;
          default:
            item.json = { stdout: out_str };
          }
        } else if (r) {
					throw new NodeOperationError(
						this.getNode(), `[stdout] ${r.stdout} \n[stderr] ${r.stderr}`, { itemIndex }
					);
        } else {
					throw new NodeOperationError(this.getNode(), "Failed to exec command", { itemIndex });
        }
			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
			}
		}

		return this.prepareOutputData(items);
	}
}
