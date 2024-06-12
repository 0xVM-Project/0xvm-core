import typescript from 'rollup-plugin-typescript2';
import babel from '@rollup/plugin-babel';
import commonjs from 'rollup-plugin-commonjs';

export default [
    {
        input: 'src/index.ts',
        plugins: [
            typescript(),
            babel({
                babelrc: false,
                presets: [['@babel/preset-env', { modules: false, loose: true }]],
                plugins: [['@babel/plugin-proposal-class-properties', { loose: true }]],
                exclude: 'node_modules/**',
            }),
            commonjs()
        ],
        output: [
            { file: 'dist/index.js', format: 'cjs' },
            // { file: 'dist/index.esm.js', format: 'es' }
        ]
    }
]