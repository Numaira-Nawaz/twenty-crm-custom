import { Injectable } from '@nestjs/common';

import {
  GraphqlQueryBaseResolverService,
  GraphqlQueryResolverExecutionArgs,
} from 'src/engine/api/graphql/graphql-query-runner/interfaces/base-resolver-service';
import {
  ObjectRecord,
  OrderByDirection,
} from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { IConnection } from 'src/engine/api/graphql/workspace-query-runner/interfaces/connection.interface';
import { WorkspaceQueryRunnerOptions } from 'src/engine/api/graphql/workspace-query-runner/interfaces/query-runner-option.interface';
import { FindDuplicatesResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import {
  GraphqlQueryRunnerException,
  GraphqlQueryRunnerExceptionCode,
} from 'src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception';
import { ObjectRecordsToGraphqlConnectionHelper } from 'src/engine/api/graphql/graphql-query-runner/helpers/object-records-to-graphql-connection.helper';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { formatResult } from 'src/engine/twenty-orm/utils/format-result.util';

@Injectable()
export class GraphqlQueryFindDuplicateCustomFieldsResolverService extends GraphqlQueryBaseResolverService<
  FindDuplicatesResolverArgs,
  IConnection<ObjectRecord>[]
> {
  async resolve(
    executionArgs: GraphqlQueryResolverExecutionArgs<FindDuplicatesResolverArgs>,
    featureFlagsMap: Record<FeatureFlagKey, boolean>,
  ): Promise<IConnection<ObjectRecord>[]> {
    const { objectMetadataItemWithFieldMaps, objectMetadataMaps } =
      executionArgs.options;

    // console.log('executionArgs.args.fields: ', executionArgs.args);

    // Fields to check for duplicates
    // const checkDuplicatesUpon = executionArgs,args.fields;

    const checkDuplicatesUpon = ['xee'];

    // console.log('checkDuplicatesUpon: ', checkDuplicatesUpon);

    // 🛑 Step 1: Validate Field Existence in Entity
    const entityMetadata = executionArgs.repository.metadata;
    const validFields = entityMetadata.columns.map((col) => col.propertyName); // Get all column names

    // Check if all fields in `checkDuplicatesUpon` exist in the entity
    const invalidFields = checkDuplicatesUpon.filter(
      (field) => !validFields.includes(field),
    );

    if (invalidFields.length > 0) {
      throw new GraphqlQueryRunnerException(
        `Invalid field(s) specified for duplicate check: ${invalidFields.join(', ')}`,
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
      );
    }

    // 🛑 Step 2: Ensure At Least One Field is Provided
    if (!checkDuplicatesUpon.length) {
      throw new GraphqlQueryRunnerException(
        'At least one field must be specified in checkDuplicatesUpon',
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
      );
    }

    // 🛑 Step 3: Proceed with Duplicate Check If Fields Are Valid
    const existingRecordsQueryBuilder = executionArgs.repository
      .createQueryBuilder(objectMetadataItemWithFieldMaps.nameSingular)
      .select(checkDuplicatesUpon.map((field) => `${field}`))
      .addSelect('COUNT(*)', 'count')
      .groupBy(checkDuplicatesUpon.map((field) => `${field}`).join(', '))
      .having('COUNT(*) > 1');

    const duplicateKeys = await existingRecordsQueryBuilder.getRawMany();

    if (!duplicateKeys.length) {
      return [];
    }

    const duplicateRecordsQueryBuilder =
      executionArgs.repository.createQueryBuilder(
        objectMetadataItemWithFieldMaps.nameSingular,
      );

    duplicateKeys.forEach((key) => {
      const condition = checkDuplicatesUpon
        .map((field) => `${field} = :${field}`)
        .join(' AND ');

      duplicateRecordsQueryBuilder.orWhere(condition, key);
    });

    const nonFormattedDuplicates =
      (await duplicateRecordsQueryBuilder.getMany()) as ObjectRecord[];

    const formattedDuplicates = formatResult<ObjectRecord[]>(
      nonFormattedDuplicates,
      objectMetadataItemWithFieldMaps,
      objectMetadataMaps,
    );

    const typeORMObjectRecordsParser =
      new ObjectRecordsToGraphqlConnectionHelper(
        objectMetadataMaps,
        featureFlagsMap,
      );

    return [
      typeORMObjectRecordsParser.createConnection({
        objectRecords: formattedDuplicates,
        objectName: objectMetadataItemWithFieldMaps.nameSingular,
        take: formattedDuplicates.length,
        totalCount: formattedDuplicates.length,
        order: [{ id: OrderByDirection.AscNullsFirst }],
        hasNextPage: false,
        hasPreviousPage: false,
      }),
    ];
  }

  async validate(
    args: FindDuplicatesResolverArgs,
    _options: WorkspaceQueryRunnerOptions,
  ): Promise<void> {
    // if (!args?.data && !args.ids) {
    //   throw new GraphqlQueryRunnerException(
    //     'You have to provide either "data" or "ids" argument',
    //     GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
    //   );
    // }
    if (args.fields?.length) {
      throw new GraphqlQueryRunnerException(
        'Please add atleast one field to check duplicates',
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
      );
    }
    // if (args.data && args.ids) {
    //   throw new GraphqlQueryRunnerException(
    //     'You cannot provide both "data" and "ids" arguments',
    //     GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
    //   );
    // }

    // if (!args.ids && isEmpty(args.data)) {
    //   throw new GraphqlQueryRunnerException(
    //     'The "data" condition can not be empty when "ids" input not provided',
    //     GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
    //   );
    // }
  }
}
