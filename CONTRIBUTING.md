# Contributing to Shroud Protocol

Thank you for your interest in contributing to Shroud Protocol! We welcome contributions from the community to help make privacy on the Casper Network accessible to everyone.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/shroud-protocol.git
    cd shroud-protocol
    ```
3.  **Install dependencies** using our setup script:
    ```bash
    ./scripts/build_all.sh
    ```

## Development Workflow

1.  **Create a branch** for your feature or fix:
    ```bash
    git checkout -b feature/my-awesome-feature
    ```
2.  **Make your changes**.
3.  **Run tests** to ensure everything is working:
    ```bash
    ./scripts/test_all.sh
    ```
4.  **Commit your changes** with clear messages.
5.  **Push to your fork** and submit a **Pull Request**.

## Code Style

-   **Rust**: Follow standard Rust idioms and run `cargo fmt` before committing.
-   **TypeScript**: Use ESLint and Prettier (configured in the project).
-   **Circom**: Keep circuits modular and well-documented.

## Pull Request Guidelines

-   Provide a clear description of the problem and the solution.
-   Link to any relevant issues.
-   Ensure all tests pass.
-   Add new tests for new features.

## Community

Join our community on [Discord/Telegram/etc.] to discuss ideas and get help.
