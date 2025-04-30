# System Patterns

## Architecture Patterns
- **Provider Pattern**: Used for state management with the Provider package
- **Repository Pattern**: For data access and abstraction
- **Service Pattern**: For encapsulating external functionality like audio recording and transcription
- **Model-View-Controller-like**: Separation of UI, business logic, and data

## Code Organization
- **Feature-based Organization**: Code is organized by feature/functionality
- **Layered Architecture**: Clear separation between UI, business logic, and data access
- **Dependency Injection**: Through Provider for passing dependencies

## Naming Conventions
- **Dart/Flutter Standard**: Following standard Dart/Flutter naming conventions
  - `camelCase` for variables and methods
  - `PascalCase` for classes
  - `snake_case` for file names
- **Semantic Naming**: Names reflect purpose and functionality

## File Structure Patterns
- **Feature Directories**: Related files grouped in directories by feature
- **Type-based Directories**: Files also organized by type (providers, screens, etc.)
- **Common Pattern**: `/lib/{type}/{feature}_{type}.dart`

## State Management
- **Provider Package**: Using Provider for state management
- **ChangeNotifier**: Classes extending ChangeNotifier for observable state
- **MultiProvider**: Wrapping the app with MultiProvider for dependency injection

## UI Patterns
- **Material Design 3**: Following Material Design guidelines
- **Component-based UI**: Breaking down UI into reusable components
- **Responsive Design**: Ensuring UI works across different screen sizes

## Data Flow
- **Unidirectional Data Flow**:
  - UI events trigger provider methods
  - Providers call repositories/services
  - Data flows back to UI through state updates
- **Event-driven**: Using state notifications to update UI when data changes 