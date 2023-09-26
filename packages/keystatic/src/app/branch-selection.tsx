import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { gql } from '@ts-gql/tag/no-transform';
import { useMemo, useState, useContext } from 'react';
import { useMutation } from 'urql';

import { Button, ButtonGroup } from '@keystar/ui/button';
import { Dialog } from '@keystar/ui/dialog';
import { gitBranchIcon } from '@keystar/ui/icon/icons/gitBranchIcon';
import { Icon } from '@keystar/ui/icon';
import { Flex, Grid } from '@keystar/ui/layout';
import { Item, Picker } from '@keystar/ui/picker';
import { ProgressCircle } from '@keystar/ui/progress';
import { Radio, RadioGroup } from '@keystar/ui/radio';
import { Content, Footer } from '@keystar/ui/slots';
import { css, tokenSchema } from '@keystar/ui/style';
import { TextField } from '@keystar/ui/text-field';
import { Heading, Text } from '@keystar/ui/typography';

import l10nMessages from './l10n/index.json';
import { useRouter } from './router';
import { BranchInfoContext, Ref_base, useRepositoryId } from './shell/data';
import { useConfig } from './shell/context';
import { getBranchPrefix } from './utils';

export function BranchPicker() {
  const { allBranches, currentBranch, defaultBranch } =
    useContext(BranchInfoContext);
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const router = useRouter();
  const config = useConfig();
  const branchPrefix = getBranchPrefix(config);
  const items = useMemo(() => {
    let defaultItems = allBranches.map(name => ({
      id: name,
      name,
    }));

    if (defaultBranch) {
      return [
        {
          id: defaultBranch,
          name: defaultBranch,
          description: stringFormatter.format('defaultBranch'),
        },
        ...defaultItems.filter(i => i.name !== defaultBranch),
      ];
    }

    return defaultItems;
  }, [allBranches, defaultBranch, stringFormatter]);

  const filteredBranches = useMemo(
    () =>
      items.filter(
        item =>
          item.name === defaultBranch ||
          !branchPrefix ||
          item.name.startsWith(branchPrefix) ||
          item.name === currentBranch
      ),
    [branchPrefix, currentBranch, defaultBranch, items]
  );

  return (
    <Picker
      aria-label={stringFormatter.format('currentBranch')}
      items={filteredBranches}
      selectedKey={currentBranch}
      onSelectionChange={key => {
        if (typeof key === 'string') {
          router.push(
            router.href.replace(
              /\/branch\/[^/]+/,
              '/branch/' + encodeURIComponent(key)
            )
          );
        }
      }}
      // styles
      prominence="low"
      width="auto"
      menuWidth={288}
      UNSAFE_className={css({ button: { contain: 'layout' } })}
    >
      {item => (
        <Item key={item.id} textValue={item.name}>
          <Icon src={gitBranchIcon} />
          <Text truncate>{item.name}</Text>
          {'description' in item && (
            <Text slot="description">{item.description}</Text>
          )}
        </Item>
      )}
    </Picker>
  );
}

export function CreateBranchDialog(props: {
  onDismiss: () => void;
  onCreate: (branchName: string) => void;
}) {
  const config = useConfig();
  const branchInfo = useContext(BranchInfoContext);
  const isDefaultBranch = branchInfo.defaultBranch === branchInfo.currentBranch;
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const [{ error, fetching }, createBranch] = useCreateBranchMutation();
  const repositoryId = useRepositoryId();
  const createBranchSubmitButtonId = 'create-branch-submit-button';

  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState(branchInfo.defaultBranch);

  const branchPrefix = getBranchPrefix(config);

  const propsForBranchPrefix = branchPrefix
    ? {
        UNSAFE_className: css({
          '& input': {
            paddingInlineStart: tokenSchema.size.space.xsmall,
          },
        }),
        startElement: (
          <Flex
            alignItems="center"
            paddingStart="regular"
            justifyContent="center"
            pointerEvents="none"
          >
            <Text color="neutralSecondary">{branchPrefix}</Text>
          </Flex>
        ),
      }
    : {};

  return (
    <Dialog size="small">
      <form
        style={{ display: 'contents' }}
        onSubmit={async event => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          const fullBranchName = (branchPrefix ?? '') + branchName;
          const name = `refs/heads/${fullBranchName}`;
          const result = await createBranch({
            input: {
              name,
              oid: branchInfo.branchNameToBaseCommit.get(baseBranch)!,
              repositoryId,
            },
          });

          if (result.data?.createRef?.__typename) {
            props.onCreate(fullBranchName);
          }
        }}
      >
        <Heading>{stringFormatter.format('newBranch')}</Heading>
        <Content>
          {isDefaultBranch ? (
            <TextField
              value={branchName}
              onChange={setBranchName}
              label={stringFormatter.format('branchName')}
              // description="Your new branch will be based on the currently checked out branch, which is the default branch for this repository."
              autoFocus
              errorMessage={error?.message}
              {...propsForBranchPrefix}
            />
          ) : (
            <Grid gap="xlarge">
              <TextField
                label={stringFormatter.format('branchName')}
                value={branchName}
                onChange={setBranchName}
                autoFocus
                errorMessage={error?.message}
                {...propsForBranchPrefix}
              />
              <RadioGroup
                label={stringFormatter.format('basedOn')}
                value={baseBranch}
                onChange={setBaseBranch}
              >
                <Radio value={branchInfo.defaultBranch}>
                  <Text>
                    {branchInfo.defaultBranch}
                    <Text visuallyHidden>.</Text>
                  </Text>
                  <Text slot="description">
                    {stringFormatter.format('theDefaultBranchInYourRepository')}
                  </Text>
                </Radio>
                <Radio value={branchInfo.currentBranch}>
                  <Text>
                    {branchInfo.currentBranch}
                    <Text visuallyHidden>.</Text>
                  </Text>
                  <Text slot="description">
                    {stringFormatter.format('theCurrentlyCheckedOutBranch')}
                  </Text>
                </Radio>
              </RadioGroup>
            </Grid>
          )}
        </Content>

        <Footer UNSAFE_style={{ justifyContent: 'flex-end' }}>
          {fetching && (
            <ProgressCircle
              aria-labelledby={createBranchSubmitButtonId}
              isIndeterminate
              size="small"
            />
          )}
        </Footer>
        <ButtonGroup>
          <Button onPress={props.onDismiss} isDisabled={fetching}>
            {stringFormatter.format('cancel')}
          </Button>
          <Button
            isDisabled={fetching}
            prominence="high"
            type="submit"
            id={createBranchSubmitButtonId}
          >
            {stringFormatter.format('create')}
          </Button>
        </ButtonGroup>
      </form>
    </Dialog>
  );
}

// Data
// -----------------------------------------------------------------------------

export function useCreateBranchMutation() {
  return useMutation(
    gql`
      mutation CreateBranch($input: CreateRefInput!) {
        createRef(input: $input) {
          __typename
          ref {
            ...Ref_base
          }
        }
      }
      ${Ref_base}
    ` as import('../../__generated__/ts-gql/CreateBranch').type
  );
}
