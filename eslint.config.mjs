import js from '@eslint/js';
import globals from 'globals';

/**
 * ESLint 扁平配置（eslint.config.mjs）。
 *
 * 设计取舍：
 *   1. 只检查**源码**，跳过 release/（里面是 app.js 等文件的发布副本，
 *      重复检查只会产生重复报错）与两个云函数的产物目录；
 *   2. 按运行环境分两组 —— 站点脚本跑在浏览器，验证脚本与云函数跑在 Node；
 *   3. **风格问题交给 Prettier**，ESLint 只拦真正的问题（未定义变量、
 *      无用代码、可疑写法），避免两套工具互相打架。
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'release/**',
      'web/**',
      'tools/env-migration/**',
      '**/*.min.js',
      // 不属于本作品：另一个项目的产出物、系统残留目录
      'ppt/**',
      '新建文件夹/**',
      // 修复前的云端函数源码留存，仅作回滚参考，不参与当前代码规范检查
      '.cloudfn-backup/**'
    ]
  },

  js.configs.recommended,

  // ① 站点脚本：浏览器环境
  {
    files: ['app.js', 'site-config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // 由 index.html 引入的 CloudBase CDN 脚本提供
        cloudbase: 'readonly'
      }
    }
  },

  // ② 验证脚本与云函数：Node 环境（CommonJS）
  {
    files: ['tools/**/*.cjs', 'tools/**/*.js', 'functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        // Node 18+ 已内置，但 globals 包的 node 集合未必包含
        fetch: 'readonly',
        AbortSignal: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly'
      }
    }
  },

  {
    rules: {
      // 允许空 catch：本项目多处用 `catch {}` 做"出错就忽略"的降级处理，
      // 并在注释里写明原因，属于有意为之。
      'no-empty': ['error', { allowEmptyCatch: true }],
      // 未使用变量降为警告：重构期间常有过渡变量，不该阻塞提交
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }]
    }
  }
];
