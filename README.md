# 0XVM CORE

## Project Overview

The primary function of the BTC Inscription Parsing and Transaction Command Processing System is to parse inscriptions from Bitcoin (BTC) transactions' Segregated Witness (SegWit) data, decompress the compressed inscription content to restore it to transaction commands, and then send these commands to the XVM execution layer for processing. Additionally, to address potential blockchain forks in the BTC network, the system is designed with a snapshot mechanism to ensure that, in the event of a fork, inconsistent transactions can be rolled back, maintaining consistency with the main network's transaction data.

## Table of Contents

- [Key Features](#key-features)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [Snapshot and Rollback Mechanism](#snapshot-and-rollback-mechanism)

## Key Features

- **Inscription Parsing**: Extract inscription data from the Segregated Witness (SegWit) information in BTC transactions.
- **Decompression and Restoration**: Decompress the compressed inscription data to restore it to its original transaction commands.
- **Command Processing**: Send the restored transaction commands to the XVM execution layer for appropriate processing.
- **Snapshot and Rollback**: In case of a fork in the BTC network, use the snapshot mechanism to roll back transactions during the fork to ensure consistency with the BTC main chain.

## Installation

1. **Clone the repository**:

    ```bash
    git clone https://github.com/0xVM-Project/0xvm-core.git
    cd 0xvm-core
    ```

2. **Install dependencies**:

    Use npm or yarn to install the dependencies:

    ```bash
    npm install
    ```

    Or

    ```bash
    yarn install
    ```

3. **Environment configuration**:

    Create a `.env` file and fill in the configuration items according to the `.env.example` file.

    ```bash
    cp .env.example .env
    ```

## Usage Guide

1. **Start the development server**:

    Use the following command to start the server in development mode:

    ```bash
    npm run start:dev
    ```

    Or

    ```bash
    yarn start:dev
    ```

2. **Access the service**:

    Once the server is running, the system will start monitoring SegWit transactions on the BTC network, parsing and processing inscription commands.

3. **Run in production environment**:

    In production, first build the project:

    ```bash
    npm run build
    ```

    Or

    ```bash
    yarn build
    ```

    Then start the production server:

    ```bash
    npm run start:prod
    ```

    Or

    ```bash
    yarn start:prod
    ```

## Snapshot and Rollback Mechanism

To ensure consistency with BTC network transaction data, this system is designed with a snapshot and rollback mechanism:

- **Snapshot**: Upon detecting a fork in the BTC network, the system will immediately create a snapshot of the current state, allowing it to be restored if needed.
- **Rollback**: If the fork is confirmed, the system will automatically roll back to the previous snapshot and undo all transaction processing during the fork, ensuring transaction data remains consistent with the BTC main chain.
