module.exports = {
  input: 'src/Choice.vue',
  output: {
    moduleName: 'VueChoice',
    sourceMap: true,
    fileName ({ format }) {
      return `vue-choice.${format}.js`
    },
    format: [
      'cjs',
      'esm',
      'umd-min'
    ]
  },
  plugins: {
    commonjs: true,
    vue: true
  }
}
