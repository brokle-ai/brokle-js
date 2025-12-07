# Contributing to Brokle JavaScript SDK

Thank you for your interest in contributing to the Brokle JavaScript SDK! This SDK is currently in early development, and we welcome community contributions.

## Current Status

The JavaScript SDK is in early development. We're building comprehensive JavaScript/TypeScript support for the Brokle Platform with features including:

- OpenAI-compatible drop-in replacement
- Native SDK with advanced features  
- TypeScript support
- Browser and Node.js compatibility
- Real-time analytics and observability

## Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn/pnpm
- TypeScript knowledge (helpful)
- Git

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/brokle-js.git
   cd brokle-js
   ```

2. **Install dependencies** (when available):
   ```bash
   npm install
   # or
   yarn install
   # or  
   pnpm install
   ```

3. **Run tests** (when available):
   ```bash
   npm test
   ```

## How to Contribute

### Types of Contributions Needed
- **Core SDK implementation**: Basic client functionality
- **OpenAI compatibility layer**: Drop-in replacement for OpenAI SDK
- **TypeScript definitions**: Comprehensive type definitions
- **Documentation**: Usage examples and API documentation
- **Testing**: Unit tests and integration tests
- **Examples**: Sample applications and use cases

### Making Changes

#### Creating a Branch
```bash
git checkout -b feature/openai-compatibility
git checkout -b fix/authentication-issue  
git checkout -b docs/add-examples
```

## Commit Guidelines

We appreciate clear, descriptive commit messages! While not strictly enforced, following these guidelines helps maintain project history:

### Preferred Format
```
<type>: <description>
```

### Types
- **`feat`**: New features or functionality
- **`fix`**: Bug fixes
- **`docs`**: Documentation changes
- **`test`**: Adding or updating tests
- **`refactor`**: Code improvements
- **`chore`**: Build process, dependency updates

### Examples
```bash
# Good examples
feat: implement OpenAI chat completions compatibility
fix: handle network errors gracefully
docs: add TypeScript usage examples
test: add unit tests for authentication
refactor: improve error handling logic
chore: update dependencies to latest versions

# Also acceptable
Add OpenAI compatibility
Fix network error handling
Update documentation
```

**Don't worry about perfect formatting** - clear communication about your changes is most important!

## Pull Request Process

### Before Submitting
1. Ensure your code builds without errors
2. Add or update tests for new functionality
3. Update documentation as needed
4. Test both browser and Node.js environments (when applicable)

### Submitting Your PR
1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** with:
   - Clear description of changes
   - Explanation of the problem being solved
   - Any breaking changes noted
   - Examples of usage (if applicable)

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix  
- [ ] Documentation update
- [ ] Breaking change

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Works in both Node.js and browser (if applicable)

## Documentation
- [ ] Updated relevant documentation
- [ ] Added code examples
```

## Development Guidelines

### Code Style
- Follow modern JavaScript/TypeScript conventions
- Use meaningful variable and function names
- Include JSDoc comments for public APIs
- Support both CommonJS and ESM imports
- Maintain compatibility with Node.js 16+

### API Design Principles
- **OpenAI Compatibility**: Maintain drop-in compatibility where possible
- **TypeScript First**: Strong typing for better developer experience
- **Async/Await**: Use modern async patterns
- **Error Handling**: Comprehensive error handling and recovery

### Example Code Structure
```typescript
// Client interface
export class BrokleClient {
  constructor(options: BrokleClientOptions) {
    // Implementation
  }

  async chat.completions.create(
    params: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    // Implementation
  }
}

// OpenAI compatibility
export class OpenAI extends BrokleClient {
  // OpenAI-compatible interface
}
```

## Testing

### Test Categories
- **Unit Tests**: Individual function testing
- **Integration Tests**: API interaction testing
- **Compatibility Tests**: OpenAI SDK compatibility
- **Browser Tests**: Browser environment testing
- **Node.js Tests**: Server environment testing

### Example Test
```typescript
import { BrokleClient } from '../src';

describe('BrokleClient', () => {
  test('should create client with valid config', () => {
    const client = new BrokleClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.brokle.com'
    });
    
    expect(client).toBeDefined();
  });
});
```

## Documentation

### README Updates
- Installation instructions
- Quick start guide
- Basic usage examples
- Configuration options

### API Documentation
- JSDoc comments for all public methods
- TypeScript interface definitions
- Parameter descriptions and examples

### Examples
Create example files in `examples/` directory:
- `examples/basic-usage.js`
- `examples/openai-compatibility.js`
- `examples/typescript-usage.ts`
- `examples/browser-usage.html`

## Release Process

### For Maintainers

To release a new version of the JavaScript SDK:

1. **Run the release script**:
   ```bash
   make release-patch  # or release-minor, release-major
   ```

2. **The script will**:
   - Validate git state (clean working directory, on main branch, up-to-date)
   - Run full test suite (blocks if tests fail)
   - Bump version in all package.json files (workspace + all 4 packages)
   - Create commit: `chore: release vX.Y.Z`
   - Create git tag: `vX.Y.Z`
   - Push commit and tag to GitHub

3. **Create GitHub Release manually**:
   - Go to: https://github.com/brokle-ai/brokle-js/releases/new
   - Select the tag that was just created
   - Click "Generate release notes"
   - Review and edit release notes as needed
   - Mark as pre-release if needed (for alpha/beta/rc versions)
   - Click "Publish release"

4. **GitHub Actions automatically**:
   - Builds all 4 packages
   - Publishes to npm:
     - brokle
     - brokle-openai
     - brokle-anthropic
     - brokle-langchain

**Note**: Publishing to npm happens automatically when you publish the GitHub Release. No manual `npm publish` needed!

## Getting Help

### Resources
- [Brokle Platform Documentation](https://docs.brokle.com)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference) (for compatibility)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### Support
- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: For questions and general discussion
- **Email**: support@brokle.com for direct contact

## Architecture Vision

### Core Features
```typescript
import { getClient, observe, Attrs } from 'brokle';

// Initialize client
const client = getClient({
  apiKey: process.env.BROKLE_API_KEY,
  environment: 'production',
  sampleRate: 1.0,  // 100% sampling
});

// Traced operations with OTEL attributes
await client.traced('my-operation', async (span) => {
  span.setAttribute(Attrs.USER_ID, 'user-123');
  return await doWork();
});

// LLM generation with GenAI attributes
await client.generation('chat', 'gpt-4', 'openai', async (span) => {
  const response = await openai.chat.completions.create({...});
  span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, response.usage.prompt_tokens);
  return response;
});
```

### Browser Support
- Modern browsers (ES2018+)
- Webpack/Vite/Rollup compatibility
- Tree-shaking support
- CDN distribution

### Node.js Support
- Node.js 16+ compatibility
- CommonJS and ESM support
- TypeScript definitions included

Thank you for helping build the Brokle JavaScript SDK! 🚀

---

**Note**: This SDK is in active development. The API and implementation details may change as we build toward the first release. Early contributors will be recognized in the project documentation and release notes.